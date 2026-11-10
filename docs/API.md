# GridCraft Backend API Documentation (v3.5.0)

Base URL: `/api/v1`

---

## Health Check

### `GET /api/v1/health`
Returns the operational health and version of the backend service.

**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "3.5.0",
  "app": "GridCraft",
  "githubApp": "gridcraft-auth",
  "timestamp": "2026-11-10T11:00:00.000Z"
}
```

---

## Authentication

### `GET /api/v1/auth/github`
Initiates the GitHub App user authorization flow.

**Query Parameters:**
- `format` (optional): If set to `json`, returns the authorization URL in a JSON payload instead of redirecting.

---

### `GET /api/v1/auth/github/callback`
Handles the redirect callback from GitHub after user authorization.

**Query Parameters:**
- `code`: The temporary GitHub authorization code.
- `state`: The unguessable state string for CSRF validation.
- `error` / `error_description`: Present if user denied authorization.

---

### `GET /api/v1/auth/me`
Retrieves the currently authenticated user session.

**Response (Authenticated - 200 OK):**
```json
{
  "authenticated": true,
  "user": {
    "id": 1234567,
    "login": "pixelartist",
    "name": "Pixel Artist",
    "avatarUrl": "https://avatars.githubusercontent.com/u/1234567",
    "htmlUrl": "https://github.com/pixelartist"
  }
}
```

---

### `POST /api/v1/auth/logout`
Signs out the user by clearing the session cookie.

---

### `POST /api/v1/auth/disconnect`
Requires authentication (`requireAuth`). Revokes the GitHub user access token with GitHub and clears the session cookie.

---

## Albums (GitHub Repositories)

All album endpoints require an authenticated user session (`requireAuth`).

### `GET /api/v1/albums`
Lists repositories and GridCraft albums accessible to the authenticated creator.

**Query Parameters:**
- `page` (optional, default: 1): Page number.
- `per_page` (optional, default: 30, max: 100): Number of albums per page.

**Response (200 OK):**
```json
{
  "albums": [
    {
      "id": 123456,
      "name": "minecraft-items",
      "fullName": "pixelartist/minecraft-items",
      "owner": "pixelartist",
      "ownerAvatar": "https://avatars.githubusercontent.com/u/123456",
      "description": "Pixel art inspired by Minecraft",
      "isPrivate": false,
      "defaultBranch": "master",
      "htmlUrl": "https://github.com/pixelartist/minecraft-items",
      "updatedAt": "2026-11-10T11:00:00.000Z",
      "createdAt": "2026-11-10T10:00:00.000Z",
      "isGridCraftAlbum": true,
      "permissions": {
        "admin": true,
        "push": true,
        "pull": true
      }
    }
  ],
  "page": 1,
  "perPage": 30,
  "total": 1
}
```

---

### `POST /api/v1/albums`
Creates a new GitHub repository under the authenticated user's account, enforces `master` as the verified default branch, and commits the initial GridCraft structure (`.gridcraft/album.json`, `artworks/`, `stories/`, `README.md`).

**Request Body:**
```json
{
  "name": "retro-items",
  "description": "Retro game item sprites",
  "isPrivate": false,
  "readme": "Optional custom README markdown content"
}
```

**Response (201 Created):**
```json
{
  "repo": {
    "id": 987654,
    "name": "retro-items",
    "fullName": "pixelartist/retro-items",
    "owner": "pixelartist",
    "ownerAvatar": "https://avatars.githubusercontent.com/u/123456",
    "description": "Retro game item sprites",
    "isPrivate": false,
    "defaultBranch": "master",
    "htmlUrl": "https://github.com/pixelartist/retro-items",
    "updatedAt": "2026-11-10T11:00:00.000Z",
    "createdAt": "2026-11-10T11:00:00.000Z"
  },
  "manifest": {
    "format": "gridcraft-album",
    "schemaVersion": 1,
    "id": "retro-items",
    "name": "retro-items",
    "description": "Retro game item sprites",
    "createdAt": "2026-11-10T11:00:00.000Z",
    "updatedAt": "2026-11-10T11:00:00.000Z",
    "createdWith": {
      "name": "GridCraft",
      "version": "3.5.0"
    }
  }
}
```

---

### `GET /api/v1/albums/:owner/:repo`
Fetches GitHub repository details and the decoded `.gridcraft/album.json` manifest.

**Response (200 OK):**
```json
{
  "repo": {
    "id": 987654,
    "name": "retro-items",
    "fullName": "pixelartist/retro-items",
    "owner": "pixelartist",
    "defaultBranch": "master",
    "isPrivate": false
  },
  "manifest": {
    "format": "gridcraft-album",
    "schemaVersion": 1,
    "id": "retro-items",
    "name": "retro-items",
    "description": "Retro game item sprites"
  },
  "isGridCraftAlbum": true
}
```

---

### `PATCH /api/v1/albums/:owner/:repo`
Updates album repository metadata (description, visibility) on GitHub.

**Request Body:**
```json
{
  "description": "Updated description",
  "isPrivate": true
}
```

---

### `DELETE /api/v1/albums/:owner/:repo`
Permanently deletes the album's GitHub repository. Requires confirming the exact repository name.

**Request Body:**
```json
{
  "confirmName": "retro-items"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Album pixelartist/retro-items deleted."
}
```

---

### `GET /api/v1/albums/:owner/:repo/commits`
Lists recent commits on the default `master` branch.

**Query Parameters:**
- `branch` (optional, default: `"master"`): Branch to query.

---

### `GET /api/v1/albums/:owner/:repo/tree`
Returns the recursive git tree for the repository on `master`.

---

### `POST /api/v1/albums/:owner/:repo/initialize`
Initializes an existing repository as a GridCraft album by ensuring `master` branch and creating `.gridcraft/album.json`.

---

## Standard Error Response Format

```json
{
  "error": {
    "code": "REQUEST_FAILED",
    "message": "Human readable explanation"
  }
}
```
