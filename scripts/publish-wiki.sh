#!/bin/bash
# Bash script to publish wiki pages to GitHub Wiki
# GitHub Wikis are separate Git repositories

REPO_NAME="signposting"
REPO_OWNER="danrwr-web"
WIKI_REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.wiki.git"
WIKI_DIR=".wiki-temp"
WIKI_SOURCE="wiki"

echo "=== GitHub Wiki Publisher ==="
echo ""

# Check if wiki directory exists locally
if [ -d "$WIKI_DIR" ]; then
    echo "Removing existing wiki directory..."
    rm -rf "$WIKI_DIR"
fi

# Create temporary directory for wiki
echo "Creating temporary wiki directory..."
mkdir -p "$WIKI_DIR"

# Try to clone existing wiki, or initialize if it doesn't exist
echo "Cloning or initializing wiki repository..."
echo "Wiki URL: $WIKI_REPO_URL"

cd "$WIKI_DIR" || exit 1

# Try to clone first (if wiki exists)
if git clone "$WIKI_REPO_URL" . 2>/dev/null; then
    echo "Successfully cloned existing wiki"
else
    echo "Wiki repository doesn't exist yet or access denied"
    echo "Initializing new wiki repository..."
    git init
    git remote add origin "$WIKI_REPO_URL"
fi

# Copy wiki files from source directory
echo "Copying wiki pages..."
cp -r "../${WIKI_SOURCE}/"* . 2>/dev/null || cp -r "../${WIKI_SOURCE}/." . 2>/dev/null

# Check if there are changes
git add -A

if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "Changes detected:"
    git status --short
    
    echo ""
    echo "Committing changes..."
    git commit -m "Update wiki documentation - $(date '+%Y-%m-%d %H:%M:%S')"
    
    echo ""
    echo "Pushing to GitHub Wiki..."
    echo "Note: You may be prompted for GitHub credentials"
    
    # Try to push to main or master branch
    if git push -u origin HEAD:main 2>/dev/null || git push -u origin HEAD:master 2>/dev/null; then
        echo ""
        echo "✓ Successfully published wiki to GitHub!"
        echo "Wiki available at: https://github.com/${REPO_OWNER}/${REPO_NAME}/wiki"
    else
        echo "Push failed. The wiki may need to be enabled on GitHub first."
        echo "Enable it at: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings"
        echo "Or you may need to authenticate with GitHub."
    fi
else
    echo "No changes to commit. Wiki is up to date."
fi

cd ..

# Clean up
echo ""
echo "Cleaning up temporary files..."
rm -rf "$WIKI_DIR"

echo ""
echo "=== Done ==="

