# GridCraft 🎨
**Current release:** `v4.0.0`\
**Platform direction:** A visual art and collaboration workspace backed by each creator's GitHub artwork library.

GridCraft stores each creator's work in one public `gridcraft-artworks` repository. A folder represents an album, a nested folder represents a Story, and JSON files inside a Story represent editable canvas artwork. GridCraft stores its own issues, pull requests, comments, and reviews; these are not GitHub Issues or Pull Requests.

---

## Storage and collaboration

- **One artwork library per creator** — signing in initializes `gridcraft-artworks`; albums are folders within that repository.
- **Album → Story → artwork** — Story folders and JSON canvas artwork are nested under the album folder; saves update GitHub files with stale-write protection.
- **GridCraft Issues and Pull Requests** — collaboration records, comments, and reviews are stored by GridCraft, independently from GitHub's issue and pull-request features.
- **Album forks** — copy an album folder and all of its contents into the current creator's artwork library.
- **Version history** — GitHub provides file storage, commit history, and optional branch workflows.

---

## Features

- **GitHub Authentication** - Sign in seamlessly with GitHub via GitHub App `gridcraft-auth`
- **Multiple Grid Sizes** - Draw on a 16×16, 32×32, 64×64, or 128×128 canvas
- **Full RGB Color Support** - Choose any color using an intuitive RGB color picker
- **Drawing Tools** - Paint brush, eraser, flood fill, transparent fill, and clear canvas
- **History & Undo/Redo** - Keep up to 15 history steps
- **Album Stories** - Create and play sequences of repository artworks, set timing/looping, and export animated GIFs
- **Branch collaboration** - Keep alternate artwork versions in GitHub branches
- **Issues and pull requests** - Track feedback and propose album changes inside GridCraft
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

- [Roadmap & Plan](PLAN.md) — Product requirements and implementation roadmap
- [Changelog](CHANGELOG.md) — Version-by-version release history
- [Architecture](docs/ARCHITECTURE.md) — High-level architecture, security, and session design
- [API Reference](docs/API.md) — Backend endpoints and response models
- [GitHub App Setup](docs/GITHUB_APP_SETUP.md) — Guide to configuring the `gridcraft-auth` app
- [User Manual](Manual.md) — Step-by-step editor guide

---

## License

MIT
