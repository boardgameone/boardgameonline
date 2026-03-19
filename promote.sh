#!/bin/bash
set -e

REPO="boardgameone/boardgameonline"

# Ensure we're on Gyan branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "Gyan" ]; then
    echo "Error: Must be on Gyan branch. Currently on: $BRANCH"
    exit 1
fi

# Ensure working tree is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working tree is not clean. Commit or stash changes first."
    exit 1
fi

# Ensure master branch exists locally (needed for gh pr create)
if ! git show-ref --verify --quiet refs/heads/master; then
    echo "Setting up local master branch..."
    git fetch origin master
    git branch master origin/master
fi

# ── Step 1: PR Gyan → master ──────────────────────────────────────────
echo ""
echo "=== Step 1: Gyan → master ==="

PR_URL=$(gh pr list -R "$REPO" --state open --head Gyan --base master --json url -q '.[0].url' 2>/dev/null || true)

if [ -z "$PR_URL" ]; then
    echo "Creating PR from Gyan → master..."
    TITLE="Deploy Gyan → master ($(date '+%Y-%m-%d %H:%M'))"
    PR_URL=$(gh pr create -R "$REPO" --base master --head Gyan --title "$TITLE" --body "Automated deploy from Gyan to master.")
    echo "PR created: $PR_URL"
else
    echo "Using existing PR: $PR_URL"
fi

echo "Merging PR..."
gh pr merge "$PR_URL" -R "$REPO" --merge --delete-branch=false

# ── Step 2: PR master → main ─────────────────────────────────────────
echo ""
echo "=== Step 2: master → main ==="

PR_URL=$(gh pr list -R "$REPO" --state open --head master --base main --json url -q '.[0].url' 2>/dev/null || true)

if [ -z "$PR_URL" ]; then
    echo "Creating PR from master → main..."
    TITLE="Deploy master → main ($(date '+%Y-%m-%d %H:%M'))"
    PR_URL=$(gh pr create -R "$REPO" --base main --head master --title "$TITLE" --body "Automated deploy from master to main.")
    echo "PR created: $PR_URL"
else
    echo "Using existing PR: $PR_URL"
fi

echo "Merging PR..."
gh pr merge "$PR_URL" -R "$REPO" --merge --delete-branch=false

# ── Sync local branches ──────────────────────────────────────────────
echo ""
echo "=== Syncing local branches ==="

git checkout master
git pull origin master

git checkout main
git pull origin main

git checkout Gyan

# ── Step 3: Deploy on server ─────────────────────────────────────────
echo ""
echo "=== Step 3: Deploying on server ==="
ssh boardgam1@198.38.86.14 "cd public_html && ./deploy.sh"

echo ""
echo "Done! Both PRs merged, local branches synced, and server deployed."
