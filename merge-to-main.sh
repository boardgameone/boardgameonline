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

# Create PR and merge
echo "Creating PR from Gyan to main..."
gh pr create --base main --head Gyan --fill

echo "Merging PR..."
gh pr merge --merge --delete-branch=false

# Sync local main
echo "Syncing local main branch..."
git checkout main
git pull origin main
git checkout Gyan

echo "Done! PR merged and local main synced."
