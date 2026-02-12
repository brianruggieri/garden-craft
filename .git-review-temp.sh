#!/bin/bash
cd /Users/brianruggieri/git/garden-craft
echo "=== GIT STATUS ==="
git status
echo ""
echo "=== GIT DIFF STAT ==="
git diff --stat
echo ""
echo "=== STAGED DIFF STAT ==="
git diff --cached --stat
echo ""
echo "=== GIT DIFF ==="
git diff
echo ""
echo "=== STAGED DIFF ==="
git diff --cached
