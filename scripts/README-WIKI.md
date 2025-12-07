# Publishing Wiki to GitHub

This directory contains scripts to publish the wiki pages from the `/wiki` folder to the GitHub Wiki.

## Prerequisites

1. **Enable GitHub Wiki** on your repository (if not already enabled):
   - Go to: `https://github.com/danrwr-web/signposting/settings`
   - Scroll to "Features" section
   - Enable "Wikis"

2. **GitHub Authentication**:
   - For HTTPS: Use a Personal Access Token (PAT) with `repo` scope
   - For SSH: Ensure your SSH key is added to GitHub

## Usage

### Windows (PowerShell)

```powershell
.\scripts\publish-wiki.ps1
```

### Linux/Mac (Bash)

```bash
chmod +x scripts/publish-wiki.sh
./scripts/publish-wiki.sh
```

## What the Script Does

1. Creates a temporary directory for the wiki repository
2. Clones the existing GitHub Wiki (or initializes if new)
3. Copies all markdown files from `/wiki` folder
4. Commits and pushes changes to GitHub
5. Cleans up temporary files

## Manual Alternative

If the script doesn't work, you can manually publish:

```bash
# Clone the wiki repository
git clone https://github.com/danrwr-web/signposting.wiki.git wiki-repo

# Copy files
cp wiki/*.md wiki-repo/

# Commit and push
cd wiki-repo
git add .
git commit -m "Update wiki documentation"
git push

# Clean up
cd ..
rm -rf wiki-repo
```

## Troubleshooting

- **"Repository not found"**: Wiki may not be enabled. Enable it in repository settings.
- **"Authentication failed"**: Use a Personal Access Token instead of password.
- **"Permission denied"**: Ensure you have write access to the repository.

