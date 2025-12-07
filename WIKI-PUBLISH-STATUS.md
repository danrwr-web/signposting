# Wiki Publishing Status

## ✅ Successfully Prepared

The wiki pages have been prepared and committed locally. All 8 wiki pages are ready to publish:

- ✅ Home.md
- ✅ Symptom-Library.md
- ✅ Clinical-Governance.md
- ✅ AI-Features.md
- ✅ Appointment-Directory.md
- ✅ High-Risk-&-Highlighting.md
- ✅ Multi-Surgery-&-RBAC.md
- ✅ Developer-Guide.md

## 🔧 Next Steps

### Option 1: Enable Wiki on GitHub (Recommended)

1. Go to: https://github.com/danrwr-web/signposting/settings
2. Scroll to the "Features" section
3. Enable "Wikis"
4. Run the script again:
   ```powershell
   .\scripts\publish-wiki.ps1
   ```

### Option 2: Manual Push

If you prefer to push manually:

```bash
# Clone the wiki repository (after enabling it)
git clone https://github.com/danrwr-web/signposting.wiki.git wiki-repo

# Copy files
copy wiki\*.md wiki-repo\

# Commit and push
cd wiki-repo
git add .
git commit -m "Initial wiki documentation"
git push

# Clean up
cd ..
rmdir /s wiki-repo
```

### Option 3: Use GitHub Web Interface

1. Enable Wiki in repository settings
2. Go to: https://github.com/danrwr-web/signposting/wiki
3. Click "Create the first page"
4. Copy content from each `.md` file in the `/wiki` folder
5. Create each page individually

## 📝 Notes

- The wiki repository URL is: `https://github.com/danrwr-web/signposting.wiki.git`
- All files are in the `/wiki` directory and ready to publish
- The script will work once the wiki is enabled and you're authenticated

## 🔐 Authentication

If prompted for credentials:
- Use a **Personal Access Token** (not password)
- Create one at: https://github.com/settings/tokens
- Required scope: `repo` (full control of private repositories)

---

**Status**: Ready to publish once wiki is enabled on GitHub.

