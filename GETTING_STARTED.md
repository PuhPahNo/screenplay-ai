# Getting Started - Quick Setup Guide

Follow these steps to get your app distributed and auto-updating!

## ✅ Phase 1: Push to GitHub (5 minutes)

```bash
# 1. Make sure you're in your project directory
cd "/Users/anthonypappano/Desktop/Screenplay Concept"

# 2. Add all new files
git add .

# 3. Commit everything
git commit -m "Add distribution setup: GitHub Actions, website, and auto-updater"

# 4. Push to GitHub
git push origin main
```

## ✅ Phase 2: Deploy Website to Render (5 minutes)

### Option A: Blueprint (Automatic - Recommended)

1. Go to: https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Select your repository: `PuhPahNo/screenplay-ai`
4. Click **"Apply"**
5. Done! Your site will be live at `https://screenplay-ai.onrender.com`

### Option B: Manual Setup

1. Go to: https://dashboard.render.com
2. Click **"New +"** → **"Static Site"**
3. Connect repository: `PuhPahNo/screenplay-ai`
4. Configure:
   - **Name**: `screenplay-ai`
   - **Branch**: `main`
   - **Build Command**: `echo "No build needed"`
   - **Publish Directory**: `website`
5. Click **"Create Static Site"**

## ✅ Phase 3: Create Your First Release (10 minutes)

```bash
# 1. Create a version tag
git tag v1.0.0

# 2. Push the tag to trigger automated builds
git push origin v1.0.0
```

### What Happens Next:

- GitHub Actions starts building (watch here: https://github.com/PuhPahNo/screenplay-ai/actions)
- ~5-15 minutes later: Mac, Windows, and Linux installers are ready
- Installers appear at: https://github.com/PuhPahNo/screenplay-ai/releases
- Your website automatically shows download links

## ✅ Phase 4: Test Everything (5 minutes)

1. **Visit your website**: `https://screenplay-ai.onrender.com`
2. **Check download button** appears and detects your OS
3. **Download the installer** and test installation
4. **Launch the app** and verify it works

## 🎉 You're Done!

Your professional distribution system is live:

- ✅ Users download from your Render website
- ✅ Installers hosted on GitHub (free, unlimited bandwidth)
- ✅ Auto-updates push to users automatically
- ✅ Multi-platform support (Mac, Windows, Linux)

## 📦 Creating Future Releases

Whenever you want to release a new version:

```bash
# 1. Update version in package.json
vim package.json  # Change "version": "1.0.1"

# 2. Commit changes
git add .
git commit -m "Release v1.0.1 - Bug fixes and improvements"
git push origin main

# 3. Create and push tag
git tag v1.0.1
git push origin v1.0.1
```

That's it! GitHub Actions handles the rest.

## 🔧 Optional: Code Signing

For now, your app will work but users will see security warnings when installing.

**To remove warnings (optional):**

### macOS ($99/year)
1. Join Apple Developer Program: https://developer.apple.com/programs/
2. Create signing certificates
3. Add secrets to GitHub repository (see RELEASE.md for details)

### Windows (Free or ~$400/year)
- Free option: SignPath for open source projects
- Paid option: Buy code signing certificate

**Note:** Most indie apps start without code signing and add it later when they have users.

## 📚 Need Help?

- **Creating releases**: See `RELEASE.md`
- **Website deployment**: See `DEPLOYMENT.md`
- **Build errors**: Check GitHub Actions logs

## 🚀 What You Built

You now have the same professional distribution setup as apps like:
- Cursor
- VS Code
- Obsidian
- Figma Desktop

Users download from your website, never see GitHub, and get automatic updates!

---

**Next Steps:**
1. Push to GitHub ⬆️
2. Deploy to Render 🌐
3. Create v1.0.0 release 🎁
4. Share with the world! 🌍

