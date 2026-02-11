#!/bin/bash

# Security check script for GardenCraft
# Verifies that no secrets are exposed before committing

set -e

echo "🔒 Running security checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES=0

# Check 1: Verify .env is gitignored
echo "1. Checking if .env is in .gitignore..."
if grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo -e "   ${GREEN}✓${NC} .env is in .gitignore"
else
    echo -e "   ${RED}✗${NC} .env is NOT in .gitignore!"
    ISSUES=$((ISSUES + 1))
fi

# Check 2: Verify .env is not tracked by git
echo "2. Checking if .env is tracked by git..."
if git ls-files --error-unmatch .env 2>/dev/null; then
    echo -e "   ${RED}✗${NC} .env IS tracked by git! Remove it immediately!"
    ISSUES=$((ISSUES + 1))
else
    echo -e "   ${GREEN}✓${NC} .env is not tracked by git"
fi

# Check 3: Check if .env.example contains real secrets
echo "3. Checking .env.example for real secrets..."
if [ -f .env.example ]; then
    if grep -qE "sk-[a-zA-Z0-9]{20,}" .env.example 2>/dev/null; then
        echo -e "   ${RED}✗${NC} .env.example contains what looks like a REAL API key!"
        ISSUES=$((ISSUES + 1))
    elif grep -qE "(password|secret|token).*[=:].*[^your-|^placeholder|^example]" .env.example 2>/dev/null; then
        echo -e "   ${YELLOW}⚠${NC}  .env.example may contain real values - please verify"
    else
        echo -e "   ${GREEN}✓${NC} .env.example looks safe"
    fi
else
    echo -e "   ${YELLOW}⚠${NC}  .env.example not found"
fi

# Check 4: Search staged files for potential secrets
echo "4. Checking staged files for secrets..."
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")
if [ -n "$STAGED_FILES" ]; then
    SECRET_PATTERNS="sk-[a-zA-Z0-9]{40,}|AIza[a-zA-Z0-9_-]{35}|[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com"

    for file in $STAGED_FILES; do
        if [ -f "$file" ]; then
            if grep -qE "$SECRET_PATTERNS" "$file" 2>/dev/null; then
                echo -e "   ${RED}✗${NC} Potential secret found in: $file"
                ISSUES=$((ISSUES + 1))
            fi
        fi
    done

    if [ $ISSUES -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} No obvious secrets in staged files"
    fi
else
    echo -e "   ${YELLOW}⚠${NC}  No files staged for commit"
fi

# Check 5: Verify .env exists for local development
echo "5. Checking local .env configuration..."
if [ -f .env ]; then
    echo -e "   ${GREEN}✓${NC} .env exists for local development"

    # Check if it has required keys
    if grep -q "OPENAI_API_KEY" .env 2>/dev/null; then
        echo -e "   ${GREEN}✓${NC} OPENAI_API_KEY is configured"
    else
        echo -e "   ${YELLOW}⚠${NC}  OPENAI_API_KEY not found in .env"
    fi
else
    echo -e "   ${YELLOW}⚠${NC}  .env not found (create from .env.example)"
fi

# Check 6: Search git history for accidentally committed secrets
echo "6. Checking git history for .env files..."
if git log --all --full-history -- .env 2>/dev/null | grep -q "commit"; then
    echo -e "   ${RED}✗${NC} .env was committed in git history!"
    echo -e "   ${RED}   You MUST rotate any secrets and clean git history!${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "   ${GREEN}✓${NC} No .env files in git history"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ All security checks passed!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
else
    echo -e "${RED}✗ Found $ISSUES security issue(s)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🚨 ACTIONS REQUIRED:"
    echo ""
    echo "If .env is tracked by git:"
    echo "  git rm --cached .env"
    echo "  git commit -m 'Remove .env from tracking'"
    echo ""
    echo "If .env.example contains real secrets:"
    echo "  Edit .env.example and replace with placeholders"
    echo ""
    echo "If secrets are in git history:"
    echo "  1. IMMEDIATELY rotate all secrets at their providers"
    echo "  2. Use BFG Repo-Cleaner or git filter-branch"
    echo "  3. See SECURITY.md for detailed instructions"
    echo ""
    exit 1
fi
