# GridCraft 🎨
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues/rohan-shridhar/gridcraft)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues-pr/rohan-shridhar/gridcraft)

**Current release:** `v3.11.0`\
**Platform Direction:** A GitHub-inspired platform for creating, organizing, versioning, sharing, and collaborating on pixel art.

GridCraft is a full-stack, GitHub-native creative platform where an album is a GitHub repository, an artwork is a versioned JSON file, a Story is an animated sequence of artworks, and branches, issues, and pull requests bring Git collaboration to pixel artists.

---

## What's New in v3.10.0–v3.11.0 ✨

- **GitHub Pull Requests**: Browse and create same-repository or fork-based PRs, inspect commits/files/conversation, submit reviews, and merge only after GitHub confirms mergeability and the user confirms the action.
- **Fork and Contribute**: Create native GitHub forks, open the resulting fork in GridCraft, see its upstream, edit on fork branches, and propose changes upstream.

## What's New in v3.7.0–v3.9.0 ✨

- **Album Stories**: Build ordered, timed artwork sequences, preview playback, and export real animated GIFs. Local Snaps can be backed up and migrated into an album; migration does not remove browser data.
- **Git Branch Workflows**: Browse, create, rename, delete, compare, and switch real GitHub branches. Artwork and Story reads/writes follow the selected branch, and unsaved edits are guarded.
- **GitHub Issues**: Filter and paginate issues, create and edit them, comment, close/reopen, and safely render Markdown, all through GitHub.
- **GitHub-Backed Artworks**: Explicit saves, history, rename/delete, and SHA-based stale-write protection.
- **`master` Default Branch**: New albums initialize with `master`; default branches cannot be deleted from GridCraft.

---

## Features

- **GitHub Authentication** - Sign in seamlessly with GitHub via GitHub App `gridcraft-auth`
- **Multiple Grid Sizes** - Draw on a 16×16, 32×32, 64×64, or 128×128 canvas
- **Full RGB Color Support** - Choose any color using an intuitive RGB color picker
- **Drawing Tools** - Paint brush, eraser, flood fill, transparent fill, and clear canvas
- **History & Undo/Redo** - Keep up to 15 history steps
- **Album Stories** - Create and play sequences of repository artworks, set timing/looping, and export animated GIFs
- **Branch collaboration** - Keep alternate artwork versions in real GitHub branches
- **GitHub Issues** - Track feedback and tasks in the repository
- **GitHub Pull Requests** - Review GitHub-backed changes and contribute through forks
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
