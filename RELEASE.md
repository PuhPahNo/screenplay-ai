# Release Guide for Screenplay AI

This guide explains how to create new releases that automatically build installers and push updates to users.

## Prerequisites

### 1. Code Signing (Optional but Recommended)

**macOS:**
- Enroll in Apple Developer Program ($99/year): https://developer.apple.com/programs/
- Create certificates in Xcode or Apple Developer portal
- Add to your GitHub repository secrets:
  - `CSC_LINK` - Base64 encoded .p12 certificate
  - `CSC_KEY_PASSWORD` - Certificate password
  - `APPLE_ID` - Your Apple ID email
  - `APPLE_ID_PASSWORD` - App-specific password

**Windows:**
- Get a code signing certificate (optional for now)
- Or use free signing via SignPath for open source projects

**Note:** Without code signing, users will see security warnings when installing. The app will still work.

## How to Create a Release

### Step 1: Update Version Number

Edit `package.json` and update the version:

```json
{
  "version": "1.0.1"  // Increment this
}
```

### Step 2: Commit Your Changes

```bash
git add .
git commit -m "Release v1.0.1 - Add new features"
git push origin main
```

### Step 3: Create a Git Tag

```bash
# Create a tag matching the version
git tag v1.0.1

# Push the tag to GitHub
git push origin v1.0.1
```

**That's it!** GitHub Actions will automatically:
1. Build installers for Mac, Windows, and Linux
2. Upload them to GitHub Releases
3. Make them available for download
4. Trigger auto-updates for existing users

## What Happens Next

### Automated Build Process (5-15 minutes)

1. **macOS Build** (~8-12 min)
   - Builds .dmg installer
   - Builds .zip for auto-updater
   - Creates universal binary (Intel + Apple Silicon)

2. **Windows Build** (~5-8 min)
   - Builds .exe installer (NSIS)
   - Builds portable .exe

3. **Linux Build** (~5-8 min)
   - Builds .AppImage
   - Builds .deb package

### Release is Published

- All installers are uploaded to: `https://github.com/PuhPahNo/screenplay-ai/releases`
- Your website automatically shows the new version
- Existing users get an "Update Available" notification

## Auto-Updates

Users with the app installed will:
1. See a notification: "Update available"
2. Click to download in background
3. Restart to install the new version

**No website visit needed!**

## Monitoring Builds

Watch the build progress:
- Go to: https://github.com/PuhPahNo/screenplay-ai/actions
- Click on the running workflow
- See logs for each platform

If a build fails:
- Check the error logs
- Fix the issue
- Delete the tag: `git tag -d v1.0.1 && git push origin :refs/tags/v1.0.1`
- Try again with a new version

## Release Checklist

Before creating a release:

- [ ] Test the app thoroughly on your local machine
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with new features/fixes
- [ ] Commit and push all changes
- [ ] Create and push version tag
- [ ] Wait for GitHub Actions to complete
- [ ] Test download links on your website
- [ ] Test auto-updater with a previous version

## Version Numbering

Use Semantic Versioning (semver):

- **v1.0.0** - Major version (breaking changes)
- **v1.1.0** - Minor version (new features)
- **v1.0.1** - Patch version (bug fixes)

Examples:
- `v1.0.0` - Initial release
- `v1.0.1` - Fixed bug with scene parsing
- `v1.1.0` - Added export to FDX feature
- `v2.0.0` - Complete UI redesign (breaking)

## Manual Build (Local Testing)

To test building installers locally:

```bash
# Build for your current platform
npm run electron:build

# Build for Mac (on Mac)
npm run build:mac

# Build for Windows (on Windows)
npm run build:win

# Build for Linux (on Linux)
npm run build:linux
```

Installers will be in the `release/` folder.

## Troubleshooting

### Build fails with "No tag found"
- Make sure you pushed the tag: `git push origin v1.0.1`

### Windows build fails
- Usually dependency issues
- Check the GitHub Actions logs
- May need to update `package-lock.json`

### Mac build fails with code signing error
- Add signing secrets to GitHub (see Prerequisites)
- Or remove signing requirements temporarily

### Downloads show old version
- GitHub API may cache for ~5 minutes
- Hard refresh your website (Cmd+Shift+R)
- Check the release page directly

## Need Help?

- Check build logs: https://github.com/PuhPahNo/screenplay-ai/actions
- Review electron-builder docs: https://www.electron.build/
- Review GitHub Actions docs: https://docs.github.com/en/actions

