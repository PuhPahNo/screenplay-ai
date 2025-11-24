# App Icons Guide

## Required Icons

To replace the default Electron icon with your custom logo:

### Quick Start (Easiest)

1. **Create one high-quality PNG**:
   - Size: 1024x1024 pixels (or minimum 512x512)
   - Name: `icon.png`
   - Place in: `build/icon.png`

2. **electron-builder will auto-generate**:
   - `icon.icns` (Mac)
   - `icon.ico` (Windows)
   - Linux icon set

### Manual (More Control)

If you want to manually create each format:

**Mac:**
- File: `build/icon.icns`
- Tool: Use online converter or macOS `iconutil`
- From: PNG → ICNS

**Windows:**
- File: `build/icon.ico`
- Tool: Use online converter or ImageMagick
- From: PNG → ICO (with multiple sizes)

**Linux:**
- Folder: `build/icons/`
- Files: 
  - `512x512.png`
  - `256x256.png`
  - `128x128.png`
  - `64x64.png`
  - `32x32.png`
  - `16x16.png`

## Design Guidelines

### Icon Design Tips
- **Simple & Recognizable**: Should work at small sizes (16x16)
- **High Contrast**: Clear at all sizes
- **No Text**: Text becomes unreadable at small sizes
- **Square Canvas**: 1:1 aspect ratio
- **Transparent Background**: For better OS integration

### Platform-Specific
- **Mac**: Rounded square (macOS adds this automatically)
- **Windows**: Sharp corners are fine
- **Linux**: Varies by distro

## Tools for Creating Icons

### Online Converters (Free)
- https://cloudconvert.com/ - PNG → ICNS/ICO
- https://convertio.co/ - Multi-format support
- https://favicon.io/ - Quick icon generator

### Design Tools
- **Figma** (free) - Design your logo
- **GIMP** (free) - Export to PNG
- **Inkscape** (free) - Vector graphics
- **Canva** (free tier) - Simple logo maker

### Automated Tools
- **electron-icon-builder** (npm package)
- **electron-builder** auto-generation from PNG

## Current Status

❌ No custom icons set (using Electron defaults)

## To Add Your Icon

1. Create/export your logo as `icon.png` (1024x1024)
2. Place it in the `build/` folder
3. Commit and push
4. Create new release
5. Done! Your app will have your custom icon

## Example Workflow

```bash
# 1. Design your logo (Figma, Canva, etc.)
# 2. Export as PNG 1024x1024
# 3. Move to build folder
mv ~/Downloads/my-logo.png build/icon.png

# 4. Commit
git add build/icon.png
git commit -m "Add custom app icon"
git push

# 5. Create release
git tag v1.0.1
git push origin v1.0.1
```

Your next build will use your custom icon!

