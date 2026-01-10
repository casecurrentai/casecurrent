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
  "scripts/push-to-github.ts",
  "scripts/force-push-github.ts",
  "scripts/push-via-contents.ts",
];

function shouldExclude(filePath: string): boolean {
  if (EXCLUDE_PATTERNS.includes(filePath)) return true;
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

    if (shouldExclude(relativePath)) continue;

    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath);
        files.push({
          path: relativePath,
          content: content.toString("base64"),
        });
      } catch {}
    }
  }
  return files;
}

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings?.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) throw new Error('Token not found');

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);

  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

async function uploadFile(octokit: Octokit, filePath: string, content: string, existingSha?: string): Promise<boolean> {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: filePath,
        message: `Add ${filePath}`,
        content: content,
        branch: BRANCH,
        sha: existingSha,
      });
      return true;
    } catch (e: any) {
      if (e.status === 403 || e.status === 429) {
        const waitTime = Math.pow(2, attempt) * 5000;
        console.log(`    Rate limited, waiting ${waitTime/1000}s (attempt ${attempt}/${maxRetries})...`);
        await sleep(waitTime);
      } else if (e.status === 422 && e.message.includes('sha')) {
        // File exists with different SHA, get the current SHA
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: filePath,
            ref: BRANCH,
          });
          if ('sha' in data) {
            return await uploadFile(octokit, filePath, content, data.sha);
          }
        } catch {
          return false;
        }
      } else {
        console.error(`    Error uploading ${filePath}: ${e.status} ${e.message}`);
        return false;
      }
    }
  }
  return false;
}

async function main() {
  console.log("[1/3] Authenticating...");
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`    Authenticated as: ${user.login}`);

  console.log("[2/3] Collecting files...");
  const files = await getAllFiles(process.cwd(), process.cwd());
  console.log(`    Found ${files.length} files`);

  console.log("[3/3] Uploading files...");
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ok = await uploadFile(octokit, file.path, file.content);
    if (ok) {
      success++;
    } else {
      failed++;
    }
    
    if ((i + 1) % 10 === 0 || i === files.length - 1) {
      console.log(`    Progress: ${i + 1}/${files.length} (${success} ok, ${failed} failed)`);
    }
    
    // Rate limit avoidance
    await sleep(500);
  }

  console.log(`\n✅ Upload complete!`);
  console.log(`   Success: ${success}, Failed: ${failed}`);
  console.log(`   Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
