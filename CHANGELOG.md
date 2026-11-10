# GridCraft Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.11.0] - 2026-11-11

### Added
- Added real GitHub repository forking with progress feedback, native parent/source relationship detection, and navigation to the completed fork.
- Displayed upstream repositories on forked albums and added a fork-to-upstream contribution flow that opens a pull request from selected fork branches.
- Preserved GitHub's repository visibility, permission, and organization policies; fork and upstream actions surface GitHub errors.

## [3.10.0] - 2026-11-11

### Added
- Replaced the Pull Requests roadmap placeholder with GitHub-backed listing, pagination, status, author, branches, timestamps, and PR detail views.
- Added pull request creation from same-repository and fork branches, with the target repository's default branch (normally `master`) preselected.
- Added PR commits, changed-file listings, conversation/comments, review submission, and open-in-GitHub links.
- Added mergeability and write-permission checks before offering an explicitly confirmed merge, with GitHub's enabled merge methods and errors.

## [3.9.0] - 2026-11-10

### Added
- Added a GitHub Issues experience with state/author/assignee/label/search filters, pagination, issue details, comments, creation/editing, close/reopen, and safe Markdown rendering.
- Added issue and comment pagination and GitHub Search API integration for text searches; pull requests are excluded from issue results.

## [3.8.0] - 2026-11-10

### Added
- Added a branch selector with URL persistence and branch-aware artwork and Story loading/saving.
- Added paginated branch listing, create/rename/delete actions, GitHub branch comparisons, changed-file summaries, and commit history.
- Added dirty-edit confirmation when switching branches and protection against deleting the default branch.

## [3.7.0] - 2026-11-10

### Added
- Added album-owned Stories referencing artwork files, with editable ordered frames, per-frame/default timing, loop controls, playback, and real GIF export.
- Added Snap JSON backup and Snap-to-Story migration while preserving local Snap data.
- Added decoded-GIF tests for frame count, dimensions, order, and delays, and removed the standalone Snap and presentation UI.

## [3.6.0] - 2026-11-10

### Added
- Replaced the album Artworks roadmap placeholder with a live GitHub-backed artwork library and JSON thumbnails.
- Added artwork creation with name, description, and supported grid-size metadata.
- Connected album artwork editing to the existing canvas tools, including grid-size changes, undo/redo, image import, PNG export, transparency, and background color.
- Added explicit saves with progress, success, and error states, meaningful Git commit messages, and per-artwork commit history.
- Added artwork rename and confirmed deletion, plus a conflict flow to inspect remote changes, reload them, or save local work as a new artwork.
- Required the current file SHA for save, rename, and delete operations to prevent stale writes.
- Added strict artwork size validation, exact cell-data persistence tests for all supported grid sizes, and useful invalid/oversized payload errors.
- Updated version metadata and the manual/API documentation for v3.6.0.

### Preserved
- Standalone editor behavior remains available. Local Snap data is retained for backup and migration into Stories.

---

## [3.5.0] - 2026-11-10

### Added
- **Albums as Real GitHub Repositories**:
  - `POST /api/v1/albums`: Creates a real GitHub repository under the authenticated user's account with `auto_init: true`.
  - **`master` Default Branch Enforcement**: Automatically detects the initial branch, renames it to `master` via GitHub's branch rename API, updates default branch, and verifies `default_branch === "master"` before confirming creation.
  - **Album Repository Structure Initialized**:
    - `.gridcraft/album.json` (Validated schema v1 manifest).
    - `artworks/.gitkeep` (Prepared directory for artwork JSON files arriving in v3.6.0).
    - `stories/.gitkeep` (Prepared directory for story animations arriving in v3.7.0).
    - `README.md` (Explaining the GridCraft album organization and folder structure).
  - Applied GitHub topics `["gridcraft", "gridcraft-album"]`.
- **Albums API Endpoints**:
  - `GET /api/v1/albums`: List albums accessible to the authenticated creator with pagination and metadata.
  - `GET /api/v1/albums/:owner/:repo`: Fetches repository metadata, permissions, and base64-decoded `.gridcraft/album.json` manifest.
  - `PATCH /api/v1/albums/:owner/:repo`: Updates repository description or visibility and syncs manifest metadata.
  - `DELETE /api/v1/albums/:owner/:repo`: Safely deletes a GitHub repository, requiring explicit repository name confirmation.
  - `GET /api/v1/albums/:owner/:repo/commits`: Fetches recent commit history on the default `master` branch.
  - `GET /api/v1/albums/:owner/:repo/tree`: Fetches the git tree structure recursively.
  - `POST /api/v1/albums/:owner/:repo/initialize`: Allows connecting/initializing an existing GitHub repository as a GridCraft album.
- **Frontend Creator Dashboard & Navigation**:
  - Live albums listing in `src/components/DashboardShell.jsx` with search filter, refresh action, and empty/error states.
  - Interactive **Create Album** modal in `src/components/CreateAlbumModal.jsx` featuring real-time slug preview (`github.com/{username}/{slug}`), public/private visibility selection, and descriptive helpers.
  - Album Detail page in `src/components/AlbumDetail.jsx` with breadcrumbs, repository badges, GitHub external link, and 7 structured tabs:
    - Overview: Manifest card, folder structure tree, and recent commits.
    - Artworks, Stories, Branches, Issues, Pull Requests: Clearly labeled roadmap badges showing future release milestones.
    - Settings: Danger zone allowing safe album repository deletion from GitHub.
  - URL routing synchronization supporting `/dashboard` and `/albums/:owner/:repo`.
- **Automated Test Coverage**:
  - 10 new tests in `server/tests/album.test.mjs` verifying repository name slugification, schema validation, unauthenticated rejection, repository creation with `master` default branch enforcement, duplicate name handling (409 Conflict), album fetching, and safe deletion confirmation.

### Preserved
- 100% of existing editor functionality intact (canvas, grid sizes, tools, shortcuts, undo/redo, image import, PNG export, and Snaps storyboard).

---

## [3.4.0] - 2026-11-10

### Added
- **Full-Stack Architecture**: Added Node.js + Express backend service in `server/` with modular routing, centralized error handling, and sensitive-data redacting request logger.
- **GitHub App Authentication**: Configured OAuth flow for GitHub App `gridcraft-auth`:
  - `GET /api/v1/auth/github`: Starts OAuth flow with cryptographically random `state` (32 bytes) stored in a secure cookie.
  - `GET /api/v1/auth/github/callback`: Validates OAuth state against CSRF, exchanges authorization code for user access token, queries GitHub user identity (`/user`), and establishes encrypted session.
  - `GET /api/v1/auth/me`: Returns sanitized authenticated user profile (`{ id, login, name, avatarUrl, htmlUrl }`) or unauthenticated status.
  - `POST /api/v1/auth/logout`: Clears session cookie safely.
  - `POST /api/v1/auth/disconnect`: Revokes token and clears session.
- **Session Safety & Token Encryption**:
  - Tokens are encrypted at rest using AES-256-GCM before being stored in HttpOnly, SameSite cookies.
  - Session payloads are signed with HMAC-SHA256 to prevent client-side tampering.
  - Zero access tokens or secrets are ever exposed to the client bundle or browser storage.
- **Health Check Endpoint**: Added `GET /api/v1/health` and `GET /health` returning service status, app version, and GitHub App metadata.
- **Frontend Auth Integration**:
  - `useAuth` hook and `AuthProvider` context in `src/hooks/useAuth.jsx`.
  - `apiClient` service in `src/services/apiClient.js` for credentialed same-origin API calls.
  - "Continue with GitHub" button in the site header and hero section for unauthenticated visitors.
  - User Account Menu in `src/components/AccountMenu.jsx` showing GitHub avatar, username, profile link, view switcher, and sign-out action.
  - Creator Dashboard shell in `src/components/DashboardShell.jsx` displaying connection info and roadmapped Albums placeholder.
- **Local Dev Workflow**:
  - Configured Vite development server proxy in `vite.config.js` to route `/api` requests to backend on port 4000.
  - Added concurrent development script `npm run dev` running both client and server simultaneously.
  - Created `.env.example` with documented environment variable template.
- **Automated Testing Suite**:
  - Node test runner integration tests in `server/tests/auth.test.mjs` verifying health check, CSRF state enforcement, OAuth callback exchange, session establishment, unauthenticated/authenticated `/me`, logout, and route protection.
  - Crypto tests in `server/tests/crypto.test.mjs` verifying random state generation, AES-256-GCM encryption/decryption, and tampering rejection.
  - Maintained 100% pass rate across existing 15 Snap unit tests.

### Preserved
- 100% of existing editor functionality intact: canvas drawing, 16/32/64/128 grid sizes, undo/redo history, pencil, eraser, flood fill, fill transparent cells, color picker, image import, and PNG export.
- 100% of existing Snaps functionality intact: SnapsPanel, PresentationMode, snap capture, thumbnails, local persistence, and WebM export.

---

## [3.3.0] - 2026-11-10

### Baseline Release
- Pixel canvas editor supporting 16×16, 32×32, 64×64, and 128×128 dimensions.
- Snaps storyboard system with local storage persistence (`gridcraft.snaps`), presentation mode, JSON backup import/export, and WebM animation recording.
- Dual theme support (dark and light themes).
