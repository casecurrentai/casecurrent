import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function main() {
  console.log('[GitHub] Getting authenticated client...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`[GitHub] Authenticated as: ${user.login}`);
  
  const repoName = 'casecurrent';
  
  let repoExists = false;
  try {
    await octokit.repos.get({ owner: user.login, repo: repoName });
    repoExists = true;
    console.log(`[GitHub] Repository ${user.login}/${repoName} already exists`);
  } catch (e: any) {
    if (e.status === 404) {
      console.log(`[GitHub] Repository not found, creating...`);
    } else {
      throw e;
    }
  }
  
  if (!repoExists) {
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: 'CaseCurrent - AI-powered legal intake platform',
      private: true,
      auto_init: false,
    });
    console.log(`[GitHub] Created repository: ${repo.html_url}`);
  }
  
  const token = await getAccessToken();
  const remoteUrl = `https://${token}@github.com/${user.login}/${repoName}.git`;
  
  console.log(`[GitHub] Configuring git remote...`);
  try {
    execSync('git remote remove github 2>/dev/null || true', { stdio: 'pipe' });
  } catch {}
  execSync(`git remote add github "${remoteUrl}"`, { stdio: 'pipe' });
  
  console.log(`[GitHub] Pushing to GitHub...`);
  execSync('git push -u github main --force', { stdio: 'inherit' });
  
  console.log(`\n[GitHub] Success! Your code is now at:`);
  console.log(`https://github.com/${user.login}/${repoName}`);
  console.log(`\nNext steps for Expo EAS:`);
  console.log(`1. Go to https://expo.dev`);
  console.log(`2. Create a new project or link to existing`);
  console.log(`3. Connect your GitHub repo: ${user.login}/${repoName}`);
  console.log(`4. Navigate to Build and start an iOS build`);
}

main().catch(console.error);
