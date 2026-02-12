#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  console.log('=== GIT STATUS ===');
  const status = execSync('git status', { encoding: 'utf-8', cwd: __dirname });
  console.log(status);

  console.log('\n=== GIT DIFF STAT ===');
  const diffStat = execSync('git diff --stat', { encoding: 'utf-8', cwd: __dirname });
  console.log(diffStat || '(no unstaged changes)');

  console.log('\n=== STAGED DIFF STAT ===');
  const stagedStat = execSync('git diff --cached --stat', { encoding: 'utf-8', cwd: __dirname });
  console.log(stagedStat || '(no staged changes)');

  console.log('\n=== UNTRACKED FILES ===');
  const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8', cwd: __dirname });
  console.log(untracked || '(no untracked files)');

} catch (error) {
  console.error('Error running git commands:', error.message);
  process.exit(1);
}
