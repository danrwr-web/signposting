# PowerShell script to publish wiki pages to GitHub Wiki
# GitHub Wikis are separate Git repositories

$REPO_NAME = "signposting"
$REPO_OWNER = "danrwr-web"
$WIKI_REPO_URL = "https://github.com/$REPO_OWNER/$REPO_NAME.wiki.git"
$WIKI_DIR = ".wiki-temp"
$WIKI_SOURCE = "wiki"

Write-Host "=== GitHub Wiki Publisher ===" -ForegroundColor Cyan
Write-Host ""

# Check if wiki directory exists locally
if (Test-Path $WIKI_DIR) {
    Write-Host "Removing existing wiki directory..." -ForegroundColor Yellow
    Remove-Item -Path $WIKI_DIR -Recurse -Force
}

# Create temporary directory for wiki
Write-Host "Creating temporary wiki directory..." -ForegroundColor Green
New-Item -ItemType Directory -Path $WIKI_DIR -Force | Out-Null

try {
    # Try to clone existing wiki, or initialize if it doesn't exist
    Write-Host "Cloning or initializing wiki repository..." -ForegroundColor Green
    Write-Host "Wiki URL: $WIKI_REPO_URL" -ForegroundColor Gray
    
    Push-Location $WIKI_DIR
    
    # Try to clone first (if wiki exists)
    $cloneSuccess = $false
    try {
        git clone $WIKI_REPO_URL . 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $cloneSuccess = $true
            Write-Host "Successfully cloned existing wiki" -ForegroundColor Green
        }
    } catch {
        Write-Host "Wiki repository doesn't exist yet or access denied" -ForegroundColor Yellow
    }
    
    # If clone failed, initialize new git repo
    if (-not $cloneSuccess) {
        Write-Host "Initializing new wiki repository..." -ForegroundColor Yellow
        git init
        git remote add origin $WIKI_REPO_URL
    }
    
    # Copy wiki files from source directory
    Write-Host "Copying wiki pages..." -ForegroundColor Green
    Copy-Item -Path "..\$WIKI_SOURCE\*" -Destination "." -Recurse -Force
    
    # Check if there are changes
    git add -A
    $status = git status --porcelain
    
    if ($status) {
        Write-Host ""
        Write-Host "Changes detected:" -ForegroundColor Cyan
        git status --short
        
        Write-Host ""
        Write-Host "Committing changes..." -ForegroundColor Green
        git commit -m "Update wiki documentation - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        
        Write-Host ""
        Write-Host "Pushing to GitHub Wiki..." -ForegroundColor Green
        Write-Host "Note: You may be prompted for GitHub credentials" -ForegroundColor Yellow
        
        # Try to push to main or master branch
        $pushSuccess = $false
        $pushOutput = git push -u origin HEAD:main 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pushSuccess = $true
        } else {
            $pushOutput = git push -u origin HEAD:master 2>&1
            if ($LASTEXITCODE -eq 0) {
                $pushSuccess = $true
            }
        }
        
        if ($pushSuccess) {
            Write-Host ""
            Write-Host "Successfully published wiki to GitHub!" -ForegroundColor Green
            Write-Host "Wiki available at: https://github.com/$REPO_OWNER/$REPO_NAME/wiki" -ForegroundColor Cyan
        } else {
            Write-Host "Push failed. The wiki may need to be enabled on GitHub first." -ForegroundColor Red
            Write-Host "Enable it at: https://github.com/$REPO_OWNER/$REPO_NAME/settings" -ForegroundColor Yellow
            Write-Host "Or you may need to authenticate with GitHub." -ForegroundColor Yellow
        }
    } else {
        Write-Host "No changes to commit. Wiki is up to date." -ForegroundColor Yellow
    }
    
} finally {
    Pop-Location
    
    # Clean up
    Write-Host ""
    Write-Host "Cleaning up temporary files..." -ForegroundColor Gray
    if (Test-Path $WIKI_DIR) {
        Remove-Item -Path $WIKI_DIR -Recurse -Force
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan

