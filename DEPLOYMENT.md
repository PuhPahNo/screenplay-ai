# Deployment Guide

## Setting Up Your Render Website

### Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Add your GitHub repository as remote
git remote add origin https://github.com/PuhPahNo/screenplay-ai.git

# Push your code
git push -u origin main
```

### Step 2: Deploy to Render

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com

2. **Create New Static Site**
   - Click "New +" button
   - Select "Static Site"

3. **Connect Your Repository**
   - Choose "Connect a repository"
   - Select `PuhPahNo/screenplay-ai`
   - Click "Connect"

4. **Configure Build Settings**
   - **Name**: `screenplay-ai` (or your preference)
   - **Branch**: `main`
   - **Root Directory**: Leave empty (repo root)
   - **Build Command**: `echo "No build needed"`
   - **Publish Directory**: `website`

5. **Click "Create Static Site"**

Your website will be live at: `https://screenplay-ai.onrender.com`

### Step 3: Custom Domain (Optional)

1. **In Render Dashboard:**
   - Go to your static site settings
   - Click "Custom Domain"
   - Add your domain (e.g., `screenplayai.com`)

2. **In Your Domain Registrar:**
   - Add CNAME record pointing to Render
   - Follow Render's instructions

## Alternative: Using Render Blueprint

Render can auto-detect the `render.yaml` file:

1. **Go to Render Dashboard**
2. **Click "New" → "Blueprint"**
3. **Select your repository**
4. Render will read `render.yaml` and set everything up automatically

## Updating Your Website

Whenever you push changes to `main` branch:
- Render automatically rebuilds your site
- Changes go live in ~30 seconds

To update the website content:

```bash
# Edit files in website/ folder
vim website/index.html

# Commit and push
git add website/
git commit -m "Update website copy"
git push origin main
```

Render will automatically deploy the changes.

## Your Complete Workflow

### Initial Setup (One Time)
1. ✅ Push code to GitHub
2. ✅ Connect Render to repository
3. ✅ Website goes live

### Creating a Release
1. Update version in `package.json`
2. Commit and push changes
3. Create version tag: `git tag v1.0.1 && git push origin v1.0.1`
4. GitHub Actions builds installers (5-15 min)
5. Website auto-updates download links
6. Users get notified of new version

### Updating Website Content
1. Edit files in `website/` folder
2. Commit and push
3. Render auto-deploys (~30 seconds)

## Testing Locally

To test the website on your computer:

```bash
# Simple Python server
cd website
python3 -m http.server 8000

# Or use Node
npx serve website
```

Visit: http://localhost:8000

## Environment Variables (If Needed Later)

If you need to add secrets or config:

1. **In Render Dashboard:**
   - Go to your site
   - Click "Environment"
   - Add key-value pairs

2. **Access in your site:**
   - Static sites can't access env vars at build time
   - Use for API endpoints if you add backend features later

## Monitoring

- **Render Dashboard**: See deploy logs, traffic, uptime
- **Custom Domain**: Add analytics (Google Analytics, Plausible, etc.)
- **Download Stats**: Check GitHub Releases for download counts

## Costs

- **Render Static Site**: FREE (0.1 GB storage, 100 GB bandwidth/month)
- **GitHub Releases**: FREE (unlimited for public repos)
- **GitHub Actions**: FREE (2,000 minutes/month)

Your entire distribution infrastructure costs **$0/month**! 🎉

## Troubleshooting

### Website not updating after push
- Check Render dashboard for deploy logs
- Verify correct branch is connected
- Hard refresh browser (Cmd+Shift+R)

### Download links show 404
- Wait for GitHub Actions to finish building
- Check: https://github.com/PuhPahNo/screenplay-ai/releases
- Verify at least one release exists

### Custom domain not working
- DNS propagation can take 24-48 hours
- Verify CNAME record in your registrar
- Check Render's custom domain status

## Next Steps

Once everything is live:

1. **Test the full flow:**
   - Visit your Render site
   - Click download button
   - Install the app
   - Create a test release to verify updates

2. **Customize your website:**
   - Update copy in `website/index.html`
   - Adjust colors in `website/styles.css`
   - Add your logo/branding

3. **Marketing:**
   - Share your website URL
   - Post on social media
   - Submit to software directories

Your professional distribution pipeline is ready! 🚀

