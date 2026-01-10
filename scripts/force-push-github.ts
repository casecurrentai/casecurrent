import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import * as path from "path";

const REPO_OWNER = "agenticvoice-stack";
const REPO_NAME = "casecurrent-v2";
const BRANCH = "main";

const EXCLUDE_PATTERNS = [
  ".git",
  "node_modules",
  ".replit",
  ".upm",
  ".cache",
  ".config",
  "dist",
  ".npm",
  ".local",
  "generated-icon.png",
  ".breakpoints",
  "replit.nix",
  "attached_assets",
];

function shouldExclude(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  return parts.some((part) => EXCLUDE_PATTERNS.includes(part));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAllFiles(dir: string, baseDir: string): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (shouldExclude(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath);
        files.push({
          path: relativePath,
          content: content.toString("base64"),
        });
      } catch (e) {
        console.log(`[Skip] Could not read: ${relativePath}`);
      }
    }
  }

  return files;
}

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function createBlobWithRetry(octokit: Octokit, file: { path: string; content: string }, retries = 3): Promise<{ path: string; sha: string; mode: string; type: string } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await octokit.git.createBlob({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        content: file.content,
        encoding: "base64",
      });
      return {
        path: file.path,
        sha: response.data.sha,
        mode: "100644" as const,
        type: "blob" as const,
      };
    } catch (e: any) {
      if (e.status === 403 && attempt < retries) {
        console.log(`    Rate limited on ${file.path}, waiting 30s (attempt ${attempt}/${retries})...`);
        await sleep(30000);
      } else if (attempt === retries) {
        console.error(`    Failed to create blob for ${file.path}: ${e.message}`);
        return null;
      }
    }
  }
  return null;
}

async function main() {
  console.log("[0/6] Authenticating with GitHub via Replit connection...");
  const octokit = await getGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`    Authenticated as: ${user.login}`);

  const workspaceDir = process.cwd();

  console.log("[1/6] Collecting files from workspace...");
  const files = await getAllFiles(workspaceDir, workspaceDir);
  console.log(`    Found ${files.length} files`);

  console.log("[2/6] Creating blobs (with rate limit handling)...");
  const blobs: { path: string; sha: string; mode: string; type: string }[] = [];
  
  let processed = 0;
  
  for (const file of files) {
    const result = await createBlobWithRetry(octokit, file);
    if (result) {
      blobs.push(result);
    }
    
    processed++;
    if (processed % 25 === 0 || processed === files.length) {
      console.log(`    Processed ${processed}/${files.length} files`);
    }
    
    await sleep(100);
  }

  console.log("[3/6] Getting base tree...");
  let baseTree: string | undefined;
  try {
    const { data: ref } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`,
    });
    const { data: commit } = await octokit.git.getCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      commit_sha: ref.object.sha,
    });
    baseTree = commit.tree.sha;
    console.log(`    Base tree: ${baseTree}`);
  } catch (e) {
    console.log("    No existing tree");
  }

  console.log(`[4/6] Creating tree with ${blobs.length} entries...`);
  await sleep(2000);
  const treeResponse = await octokit.git.createTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    base_tree: baseTree,
    tree: blobs,
  });
  const treeSha = treeResponse.data.sha;
  console.log(`    Tree SHA: ${treeSha}`);

  console.log("[5/6] Getting parent commit...");
  let parentSha: string | undefined;
  try {
    const refResponse = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`,
    });
    parentSha = refResponse.data.object.sha;
    console.log(`    Parent SHA: ${parentSha}`);
  } catch (e) {
    console.log("    No existing branch");
  }

  console.log("[6/6] Creating commit and updating ref...");
  const commitResponse = await octokit.git.createCommit({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    message: "CaseCurrent platform with GitHub Actions workflow for iOS builds",
    tree: treeSha,
    parents: parentSha ? [parentSha] : [],
  });
  const commitSha = commitResponse.data.sha;
  console.log(`    Commit SHA: ${commitSha}`);

  try {
    await octokit.git.updateRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`,
      sha: commitSha,
      force: true,
    });
    console.log(`    Updated refs/heads/${BRANCH}`);
  } catch (e) {
    await octokit.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${BRANCH}`,
      sha: commitSha,
    });
    console.log(`    Created refs/heads/${BRANCH}`);
  }

  console.log("\n✅ Successfully pushed to GitHub!");
  console.log(`   Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
  console.log(`   Branch: ${BRANCH}`);
  console.log(`   Commit: ${commitSha}`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
