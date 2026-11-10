# GridCraft Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
