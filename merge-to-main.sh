#!/bin/bash
set -e

# Ensure we're on Gyan branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "Gyan" ]; then
    echo "Error: Must be on Gyan branch. Currently on: $BRANCH"
    exit 1
fi

# Push to origin
echo "Pushing to origin/Gyan..."
git push -u origin Gyan

# Check if PR already exists, otherwise create one
echo "Checking for existing PR..."
PR_URL=$(gh pr view --json url -q '.url' 2>/dev/null || true)

if [ -z "$PR_URL" ]; then
    echo "Creating PR from Gyan to main..."
    PR_URL=$(gh pr create --base main --head Gyan --fill)
    echo "PR created: $PR_URL"
else
    echo "Using existing PR: $PR_URL"
fi

echo "Merging PR..."
gh pr merge "$PR_URL" --merge --delete-branch=false

# Sync local main
echo "Syncing local main branch..."
git checkout main
git pull origin main
git checkout Gyan

echo "Done! PR merged and local main synced."
