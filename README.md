# Screenplay AI

Professional AI-powered screenplay writing desktop application.

## Features

- ✍️ **Industry-Standard Formatting** - Automatic screenplay formatting with Fountain support
- 🤖 **AI Writing Assistant** - Intelligent dialogue suggestions and scene analysis
- 👥 **Character Management** - Track character arcs and relationships
- 🎬 **Scene Organization** - Visual story structure with scene cards
- 📊 **Story Analysis** - AI-powered storyline analysis
- 📄 **Export** - PDF, Final Draft (FDX), and Fountain formats

## Download

Visit **[screenplayai.com](https://screenplay-ai.onrender.com)** to download for:
- macOS (Intel & Apple Silicon)
- Windows 10/11
- Linux (AppImage)

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production
npm run electron:build
```

### Project Structure

```
screenplay-ai/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React UI
│   ├── screenplay/     # Fountain parser & formatter
│   ├── ai/            # OpenAI integration
│   ├── database/      # SQLite data layer
│   └── export/        # PDF/FDX exporters
├── website/           # Landing page (Render)
└── .github/          # CI/CD workflows
```

## Releasing

See [GETTING_STARTED.md](GETTING_STARTED.md) for initial setup.

To create a new release:

```bash
# Update version in package.json
# Commit changes
git add .
git commit -m "Release v1.0.1"
git push

# Create and push tag
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions automatically builds installers for all platforms.

See [RELEASE.md](RELEASE.md) for detailed release process.

## Distribution

- **Website**: Hosted on Render (free)
- **Installers**: GitHub Releases (free)
- **Auto-updates**: electron-updater via GitHub

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment guide.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Desktop**: Electron
- **Build**: Vite, electron-builder
- **AI**: OpenAI GPT-4
- **Database**: SQLite (better-sqlite3)
- **Export**: PDFKit, custom FDX writer

## License

PROPRIETARY - See [LICENSE](LICENSE) for details.

Copyright © 2024 Screenplay AI. All Rights Reserved.

## Support

For issues or questions, contact: support@screenplayai.com

