# GridCraft Backend API Documentation (v3.9.0)

Base URL: `/api/v1`

---

## Health Check

### `GET /api/v1/health`
Returns the operational health and version of the backend service.

**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "3.9.0",
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
      "version": "3.9.0"
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
Lists recent commits on the selected branch.

**Query Parameters:**
- `branch` (optional, default: `"master"`): Branch to query.

---

### `GET /api/v1/albums/:owner/:repo/tree`
Returns the recursive git tree for the repository. Accepts the optional
`branch` query parameter (default: `master`).

---

### `POST /api/v1/albums/:owner/:repo/initialize`
Initializes an existing repository as a GridCraft album by ensuring `master` branch and creating `.gridcraft/album.json`.

---

## Artworks

All artwork endpoints require an authenticated GitHub session. Files are stored
as JSON under `artworks/` in the album repository. Supported grid sizes are
16, 32, 64, and 128; `cells` contains exactly `gridSize * gridSize` hex colors
or `null` values.

### `GET /api/v1/albums/:owner/:repo/artworks`
Lists validated artwork files on the selected branch. The optional `branch`
query parameter defaults to `master`. Each artwork includes its current file
`sha`, which must be supplied for later writes.

### `POST /api/v1/albums/:owner/:repo/artworks`
Creates an artwork and an initial GitHub commit.

```json
{
  "name": "Golden Apple",
  "description": "A pixel-art item",
  "gridSize": 16,
  "backgroundColor": "transparent"
}
```

`backgroundColor` may be `"transparent"` or a hex color. An optional `cells`
array is used when saving a copy of existing pixel data.

### `GET /api/v1/albums/:owner/:repo/artworks/:artworkId`
Returns `{ "artwork": { ... }, "sha": "..." }` for an artwork file.

### `PUT /api/v1/albums/:owner/:repo/artworks/:artworkId`
Saves a complete artwork and commits it. The current file SHA is required;
GitHub rejects stale SHAs with `409 CONFLICT`.

```json
{
  "sha": "current-file-sha",
  "artwork": {
    "format": "gridcraft-artwork",
    "schemaVersion": 1,
    "id": "golden-apple",
    "name": "Golden Apple",
    "description": "A pixel-art item",
    "gridSize": 16,
    "width": 16,
    "height": 16,
    "backgroundColor": "transparent",
    "cells": ["#e63946", null],
    "createdAt": "2026-11-10T11:00:00.000Z"
  }
}
```

The `cells` array in this abbreviated example must contain exactly 256 entries
for a 16×16 artwork.

### `PATCH /api/v1/albums/:owner/:repo/artworks/:artworkId`
Renames an artwork and its JSON file. Requires `{ "newName": "...", "sha": "current-file-sha" }`.

### `DELETE /api/v1/albums/:owner/:repo/artworks/:artworkId`
Deletes an artwork file. Requires `{ "sha": "current-file-sha" }`.

### `GET /api/v1/albums/:owner/:repo/artworks/:artworkId/commits`
Lists recent commits for the artwork file. Accepts the optional `branch` query
parameter, defaulting to `master`.

---

## Stories

Stories are stored as manifests under `stories/<storyId>/story.json`. All
endpoints accept an optional `branch` query parameter (default: `master`).
Frames reference existing artwork files; pixel data is not duplicated.

- `GET /api/v1/albums/:owner/:repo/stories` — list Stories.
- `POST /api/v1/albums/:owner/:repo/stories` — create a Story with `name`,
  optional `description`, `loop`, `defaultFrameDurationMs`, and `frames`.
- `GET /api/v1/albums/:owner/:repo/stories/:storyId` — read a Story and its
  current file SHA.
- `PUT /api/v1/albums/:owner/:repo/stories/:storyId` — save `{ "story": {},
  "sha": "current-file-sha" }`; a stale SHA is rejected.
- `DELETE /api/v1/albums/:owner/:repo/stories/:storyId` — delete with the
  current `{ "sha": "..." }`.

Each frame has an `artworkId`, matching `artworkPath` (`artworks/<id>.json`),
and integer `durationMs`. Referenced artwork files are checked before a Story
is written.

## Branches

- `GET /api/v1/albums/:owner/:repo/branches?page=1&per_page=30` — paginated
  branches, actual default branch, protection flags, and a GitHub pagination
  link.
- `POST /api/v1/albums/:owner/:repo/branches` — create from `{ "name": "...",
  "from": "master" }`.
- `GET /api/v1/albums/:owner/:repo/branches/:branch` — branch and latest commit
  details.
- `PATCH /api/v1/albums/:owner/:repo/branches/:branch` — rename with
  `{ "newName": "..." }`.
- `DELETE /api/v1/albums/:owner/:repo/branches/:branch` — delete an eligible
  branch; the default branch cannot be deleted.
- `GET /api/v1/albums/:owner/:repo/compare?base=master&head=feature` — return
  GitHub's comparison status, commits, and changed files.
- `GET /api/v1/albums/:owner/:repo/branches/commits?branch=master&page=1` —
  list commits on a branch.

## Issues

- `GET /api/v1/albums/:owner/:repo/issues` — list issues with `state`, `author`,
  `assignee`, comma-separated `labels`, text `q`, `page`, and `per_page`
  filters. Text searches use GitHub's Search API. Pull requests are excluded.
- `POST /api/v1/albums/:owner/:repo/issues` — create with `title`, optional
  Markdown `body`, `labels`, and `assignees`.
- `GET /api/v1/albums/:owner/:repo/issues/:number?page=1` — issue detail and a
  paginated comments page.
- `PATCH /api/v1/albums/:owner/:repo/issues/:number` — update `title`, `body`,
  and/or `state` (`open` or `closed`).
- `POST /api/v1/albums/:owner/:repo/issues/:number/comments` — add a comment
  with `{ "body": "..." }`.

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
