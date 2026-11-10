# GridCraft 🎨
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues/rohan-shridhar/gridcraft)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues-pr/rohan-shridhar/gridcraft)

**Current release:** `v3.5.0`\
**Platform Direction:** A GitHub-inspired platform for creating, organizing, versioning, sharing, and collaborating on pixel art.

GridCraft is a full-stack, GitHub-native creative platform where an album is a GitHub repository, an artwork is a versioned JSON file, a Story is an animated sequence of artworks, and branches, issues, and pull requests bring Git collaboration to pixel artists.

---

## What's New in v3.5.0 ✨

- **Albums as Real GitHub Repositories**: Create and manage albums that map 1:1 to GitHub repositories under your account.
- **`master` Default Branch Enforced**: Every new album is initialized or renamed to verify `master` as its default branch.
- **Album Structure Initialized**: Automatically sets up `.gridcraft/album.json` manifest, `artworks/`, `stories/`, and `README.md`.
- **Creator Dashboard & Explorer**: Live album listing, search filter, and detailed album repository overview with commit history and folder tree.
- **Safe Repository Operations**: Public/Private visibility toggling and protected deletion requiring explicit confirmation.
- **Full-Stack GitHub Integration**: Communicates directly through the `gridcraft-auth` GitHub App with zero tokens in client storage.
- **Preserved Pixel Editor**: All drawing tools, grid sizes, undo/redo, image import, PNG export, and Snaps storyboard system remain completely functional.

---

## Features

- **GitHub Authentication** - Sign in seamlessly with GitHub via GitHub App `gridcraft-auth`
- **Multiple Grid Sizes** - Draw on a 16×16, 32×32, 64×64, or 128×128 canvas
- **Full RGB Color Support** - Choose any color using an intuitive RGB color picker
- **Drawing Tools** - Paint brush, eraser, flood fill, transparent fill, and clear canvas
- **History & Undo/Redo** - Keep up to 15 history steps
- **Snaps Storyboard & Presentation** - Save multiple frames, preview slideshows, and export as WebM (evolving to album-owned Stories in v3.7.0)
- **Export & Import** - Download artwork as PNG or import images/SVGs onto the canvas
- **Dual Themes** - Dark and light mode toggle

---

## Keyboard Shortcuts

Shortcuts work while the drawing grid is visible:

| Action | Shortcut |
| --- | --- |
| Undo | `Ctrl + Z` |
| Redo | `Ctrl + Y` |
| Paint brush | `A` |
| Fill enclosed cells | `B` |
| Fill transparent cells | `C` |
| Clear canvas | `D` |
| Eraser | `E` |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example environment configuration:

```bash
cp .env.example .env
```

Add your `gridcraft-auth` GitHub App credentials (`GITHUB_APP_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_PRIVATE_KEY`).

### 3. Run development servers

```bash
npm run dev
```

This starts:
- Express backend at `http://localhost:4000`
- Vite frontend at `http://localhost:5173` (proxies `/api` calls to the backend)

### 4. Run tests

```bash
npm test            # Run unit tests
npm run test:server # Run backend integration tests
```

---

## Documentation

- [Roadmap & Plan](PLAN.md) — The comprehensive version-by-version roadmap to v4.0.0
- [Changelog](CHANGELOG.md) — Version-by-version release history
- [Architecture](docs/ARCHITECTURE.md) — High-level architecture, security, and session design
- [API Reference](docs/API.md) — Backend endpoints and response models
- [GitHub App Setup](docs/GITHUB_APP_SETUP.md) — Guide to configuring the `gridcraft-auth` app
- [User Manual](Manual.md) — Step-by-step editor guide

---

## License

MIT
