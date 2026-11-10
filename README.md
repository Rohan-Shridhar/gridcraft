# GridCraft 🎨
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues/rohan-shridhar/gridcraft)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues-pr/rohan-shridhar/gridcraft)

**Current release:** `v3.4.0`\
**Platform Direction:** A GitHub-inspired platform for creating, organizing, versioning, sharing, and collaborating on pixel art.

GridCraft is evolving into a full-stack, GitHub-native creative platform where an album is a GitHub repository, an artwork is a versioned JSON file, a Story is an animated sequence of artworks, and branches, issues, and pull requests bring Git collaboration to pixel artists.

---

## What's New in v3.4.0 ✨

- **Full-Stack Backend**: Node.js + Express backend service running on port 4000.
- **GitHub App Authentication**: Sign in with GitHub using the `gridcraft-auth` GitHub App with CSRF protection and secure session management.
- **Creator Dashboard Shell**: Welcoming dashboard view displaying your GitHub identity and previewing the upcoming Git-backed albums system (v3.5.0).
- **Zero Token Leakage**: Access tokens are encrypted at rest with AES-256-GCM and stored only in HttpOnly SameSite cookies; zero secrets reach the client browser or git history.
- **Preserved Pixel Editor**: All classic drawing tools, 16/32/64/128 grids, undo/redo, PNG export, image import, and Snaps storyboard functionality remain 100% functional.

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
