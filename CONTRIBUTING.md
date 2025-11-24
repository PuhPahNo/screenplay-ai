# Contributing to Screenplay AI

Thank you for your interest in contributing to Screenplay AI! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/screenplay-ai.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Running the App

```bash
# Development mode with hot reload
npm run electron:dev

# Build for production
npm run electron:build

# Run linter
npm run lint

# Type check
npm run type-check
```

### Project Structure

- `src/main/` - Electron main process (Node.js)
- `src/renderer/` - React UI components
- `src/shared/` - Shared TypeScript types
- `src/ai/` - OpenAI integration
- `src/database/` - SQLite database management
- `src/screenplay/` - Fountain parser
- `src/export/` - Export functionality (PDF, FDX)

### Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Commits

- Write clear, descriptive commit messages
- Use present tense ("Add feature" not "Added feature")
- Reference issues in commits (e.g., "Fix #123")

## Areas for Contribution

### High Priority

- **Bug fixes**: Check the Issues tab for bugs
- **Performance improvements**: Optimize rendering, parsing, AI calls
- **Documentation**: Improve README, add tutorials
- **Tests**: Add unit and integration tests

### Feature Ideas

- Collaboration features (real-time editing)
- Cloud sync for projects
- Storyboard integration
- Custom AI model training
- Mobile companion app
- Script breakdown tools
- Production scheduling
- Version control integration

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Submit PR with clear description
6. Wait for review

### PR Guidelines

- One feature/fix per PR
- Keep PRs focused and small
- Include screenshots for UI changes
- Link related issues
- Respond to review feedback

## Testing

```bash
# Run tests (when available)
npm test

# Test the build
npm run electron:build
```

### Manual Testing Checklist

- [ ] Create new project
- [ ] Open existing project
- [ ] Write screenplay with Fountain format
- [ ] Character extraction works
- [ ] Scene parsing works
- [ ] AI chat responds correctly
- [ ] Export to PDF works
- [ ] Export to FDX works
- [ ] Settings persist correctly
- [ ] Dark/light theme works

## Code Review

All contributions go through code review:

- Maintainers will review your PR
- Address feedback promptly
- Be respectful and constructive
- Learn from the review process

## Reporting Bugs

Use GitHub Issues with this template:

**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Step 1
2. Step 2
3. ...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., macOS 13.0]
- Version: [e.g., 1.0.0]

**Screenshots**
If applicable

## Feature Requests

Use GitHub Issues with "Feature Request" label:

**Problem**
What problem does this solve?

**Proposed Solution**
How should it work?

**Alternatives**
Other solutions considered

**Additional Context**
Mockups, examples, etc.

## Questions?

- Open a Discussion on GitHub
- Check existing Issues and Discussions
- Read the README and documentation

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on what's best for the project
- Show empathy towards others
- Accept constructive criticism gracefully

Thank you for contributing! 🎬

