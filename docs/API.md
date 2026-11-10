# GridCraft API (v4.0.0)

Base URL: `/api/v1`. Except for health and OAuth routes, endpoints require the
authenticated GridCraft session cookie.

## Storage model

Each user has one public GitHub repository named `gridcraft-artworks`. Albums
are root-level folders; Stories are folders inside albums; artwork is stored as
JSON files inside Story folders. `album.json` and `story.json` contain metadata.
GridCraft Issues and Pull Requests, including their comments and reviews, are
stored in GridCraft's SQLite database and do not create GitHub issues or pull
requests. Forking copies an album folder into the current user's library.

## Authentication and health

- `GET /api/v1/health` — application health and version.
- `GET /api/v1/auth/github` — start GitHub OAuth.
- `GET /api/v1/auth/github/callback` — validate OAuth state, initialize the
  user's artwork library, and establish a session.
- `GET /api/v1/auth/me` — current session profile.
- `POST /api/v1/auth/logout` — clear the session.
- `POST /api/v1/auth/disconnect` — revoke the GitHub token and clear the session.

## Albums and artwork files

- `GET /api/v1/albums?page=1&per_page=30` — list indexed albums; the current
  user's artwork repository is synchronized before listing.
- `POST /api/v1/albums` — create an album folder and `album.json` in the user's
  artwork repository. Body: `{ "name": "...", "description": "..." }`.
- `GET /api/v1/albums/:owner/:album` — fetch an album and its manifest.
- `PATCH /api/v1/albums/:owner/:album` — update album metadata.
- `DELETE /api/v1/albums/:owner/:album` — delete the album folder after
  confirmation with `{ "confirmName": "..." }`.
- `GET /api/v1/albums/:owner/:album/tree` — album files and folders.
- `GET /api/v1/albums/:owner/:album/commits` — recent GitHub commit history.

Story endpoints:

- `GET|POST /api/v1/albums/:owner/:album/stories` — list or create Story folders.
- `GET|PUT|DELETE /api/v1/albums/:owner/:album/stories/:storyId` — read,
  update, or delete a Story manifest.
- `POST /api/v1/albums/:owner/:album/stories/:storyId/frames` — add a frame.
- `PATCH /api/v1/albums/:owner/:album/stories/:storyId/frames/order` — reorder
  frames.

Artwork endpoints use the nested route
`/api/v1/albums/:owner/:album/stories/:storyId/artworks`:

- `GET|POST` — list artworks in a Story or create an artwork JSON file.
- `GET|PUT|PATCH|DELETE /:artworkId` — read, save, rename, or delete an artwork.
- `GET /:artworkId/commits` — artwork file history.

Saves and deletes require the current file SHA to prevent stale writes. Only
the album owner can modify its files.

## GridCraft Issues

- `GET /api/v1/albums/:owner/:album/issues` — list with `state`, `author`,
  `assignee`, comma-separated `labels`, text `q`, `page`, and `per_page`.
- `POST /api/v1/albums/:owner/:album/issues` — create with `title`, optional
  Markdown `body`, `labels`, and `assignees`.
- `GET /api/v1/albums/:owner/:album/issues/:number?page=1` — issue plus a
  paginated comments page.
- `PATCH /api/v1/albums/:owner/:album/issues/:number` — update `title`, `body`,
  or `state` (`open` or `closed`).
- `POST /api/v1/albums/:owner/:album/issues/:number/comments` — add a comment
  using `{ "body": "..." }`.

The issue author or album owner may edit an issue. Any signed-in user may
comment.

## GridCraft Pull Requests

- `GET /api/v1/albums/:owner/:album/pulls?state=open&page=1&per_page=20` — list
  GridCraft pull requests associated with an album.
- `POST /api/v1/albums/:owner/:album/pulls` — create a request with `title`,
  optional `body`, and source `headOwner` and `headAlbum` (or `head` as
  `owner/album`). The source album must belong to the submitting user.
- `GET /api/v1/albums/:owner/:album/pulls/:number` — request details, file
  changes, comments, and reviews.
- `PATCH /api/v1/albums/:owner/:album/pulls/:number` — update title/body/state.
- `POST /api/v1/albums/:owner/:album/pulls/:number/comments` — add a comment.
- `POST /api/v1/albums/:owner/:album/pulls/:number/reviews` — submit
  `{ "event": "COMMENT|APPROVE|REQUEST_CHANGES", "body": "..." }`.
- `PUT /api/v1/albums/:owner/:album/pulls/:number/merge` — merge proposed file
  changes. Only the base album owner may merge; the service checks file
  snapshots and rejects stale changes.

These are GridCraft database records. GitHub is used only to read and write the
underlying artwork-library files.

## Forks and branches

- `POST /api/v1/albums/:owner/:album/forks` — copy an album and its contents
  into the current user's `gridcraft-artworks` repository.
- `GET /api/v1/forks?page=1&per_page=30` — list the current user's copied albums.
- `/api/v1/albums/:owner/:album/branches` — branch operations against the
  owner's shared artwork library.
- `/api/v1/albums/:owner/:album/compare?base=...&head=...` — compare library
  branches.

## Errors

Errors use `{ "error": { "code": "...", "message": "..." } }`. Stale GitHub
file writes return `409 CONFLICT`; invalid payloads return `400`; authorization
failures return `401` or `403`; missing albums or records return `404`.
