# GridCraft Architecture (v3.9.0)

## System Overview

```
Browser Client (React 19 + Vite)
       │
       │ Same-origin /api/v1 calls (proxied in dev, direct in prod)
       ▼
Node.js + Express Backend (`server/`)
       │
       │ GitHub OAuth & REST API calls (Bearer User Token)
       ▼
GitHub REST API (`api.github.com`)
       ├── User Profile Identity (`/user`)
       ├── Album Repositories (`/user/repos`, `/repos/{owner}/{repo}`)
       ├── Default Branch `master` Enforcement (`/branches/{branch}/rename`)
       ├── Album Manifests & Tree (`/contents/.gridcraft/album.json`)
       └── Artworks, Stories, Branches, Issues, PRs
```

## Security & Session Architecture

1. **GitHub App User Authorization**:
   - GridCraft uses a dedicated GitHub App (`gridcraft-auth`).
   - Authorization flow uses an unpredictable, 32-byte cryptographically generated `state` parameter stored in an HttpOnly, SameSite `gc_oauth_state` cookie to prevent CSRF attacks.
   - The authorization code exchange occurs entirely server-side between the Express backend and GitHub.
2. **Encrypted Sessions**:
   - Access tokens received from GitHub are encrypted using **AES-256-GCM** with a dedicated encryption key before storage.
   - The session cookie (`gc_session`) contains user profile data and the encrypted token, signed with an HMAC-SHA256 signature to prevent tampering.
   - The session cookie is configured with `HttpOnly: true`, `SameSite: Lax`, and `Secure: true` in production.
   - **Zero tokens or secrets are ever exposed to the client-side JavaScript, localStorage, or Git history.**
3. **Repository Authorization Enforcement**:
   - Every album operation calls GitHub's official REST API on behalf of the authenticated user token.
   - Private album data is strictly protected by GitHub's permission checks; an unauthorized user cannot view a private album by changing URL parameters.
4. **Redacted Logging**:
   - The Express request logger strictly redacts sensitive headers (`Authorization`, `Cookie`, `Set-Cookie`, `X-Hub-Signature-256`) and query parameters (`code`, `state`, `token`).

## Frontend Structure

- `src/App.jsx`: Main application container managing routing (`/`, `/dashboard`, `/albums/:owner/:repo`), theme, view switching (`editor`, `dashboard`, `album-detail`), canvas shortcuts, and core layout.
- `src/Header.jsx`: Site navigation, brand, theme toggle, and account menu.
- `src/components/AccountMenu.jsx`: Dropdown menu for authenticated users displaying profile info, dashboard toggle, and sign-out.
- `src/components/DashboardShell.jsx`: Creator dashboard displaying live album repositories, search filter, and creation action.
- `src/components/CreateAlbumModal.jsx`: Modal for creating an album with live slug validation, public/private toggle, and GitHub initialization.
- `src/components/AlbumDetail.jsx`: Album repository view with artwork, Story, branch, issue, and settings tabs.
- `src/components/StoriesTab.jsx`: Branch-scoped Story manifests, artwork references, playback, GIF export, and local Snap migration.
- `src/components/BranchSelector.jsx`, `src/components/BranchesTab.jsx`: Branch selection and GitHub-backed branch operations.
- `src/components/IssuesTab.jsx`: GitHub Issues search, pagination, editing, comments, and safe Markdown rendering.
- `src/hooks/useSnaps.js`: Reads existing local Snap data so users can back it up or migrate it; the standalone Snap and presentation UI has been removed.
- `src/hooks/useAuth.jsx`: Authentication context and hook communicating with `/api/v1/auth/me`.
- `src/services/apiClient.js`: Credentialed API client for auth and album operations.
- `src/Grid.jsx`, `src/Tools.jsx`, `src/Menu.jsx`: Core pixel canvas drawing components.
- `src/components/ArtworkEditor.jsx`, `src/hooks/useArtworkEditor.js`: Branch-aware artwork editing and SHA-protected saves.

## Backend Structure

- `server/src/app.js`: Express application setup with CORS, cookie parsing, logging, and error handling.
- `server/src/server.js`: Server entry point listening on port 4000.
- `server/src/config/env.js`: Environment configuration and validation.
- `server/src/controllers/authController.js`: Controller handling OAuth initiation, callback, profile lookup, and logout.
- `server/src/controllers/albumController.js`: Controller handling album CRUD, commits, and tree endpoints.
- `server/src/services/storyService.js`, `branchService.js`, `issueService.js`: GitHub-backed Story, branch, and issue workflows.
- `server/src/services/githubAuthService.js`: GitHub OAuth exchange and user profile fetch service.
- `server/src/services/albumService.js`: GitHub repository creation, `master` default branch enforcement, and manifest initialization service.
- `server/src/validators/albumValidator.js`: Zod schemas for album manifests, creation payloads, and repository name slugification.
- `server/src/middleware/auth.js`: Session verification and route protection middleware.
- `server/src/middleware/logger.js`: Sensitive data-redacting request logger.
- `server/src/utils/crypto.js`: AES-256-GCM token encryption and HMAC session signing utilities.
