# GridCraft Architecture (v4.0.0)

## System overview

```text
Browser client (React + Vite)
       │ authenticated /api/v1 requests
       ▼
Node.js + Express backend
       ├── SQLite: GridCraft users, album index, issues, pull requests, comments, reviews
       └── GitHub REST API
             ├── OAuth identity and one gridcraft-artworks repository per creator
             ├── album folders and nested Story/artwork JSON files
             └── Git branches and version history
```

GitHub is the durable file store for artwork libraries. GridCraft collaboration
records are application data in SQLite; creating or reviewing a GridCraft issue
or pull request does not create a GitHub issue or pull request. Forking copies
an album folder into the current user's `gridcraft-artworks` repository.

## Artwork library layout

Each user has one public `gridcraft-artworks` repository. Album folders are
directly under the repository root. Each album contains `album.json` and
Story folders; each Story contains `story.json` and editable artwork JSON
files. For example:

```text
forest/
  album.json
  opening/
    story.json
    fern.json
```

The server indexes album manifests in SQLite so albums can be listed and
associated with GridCraft collaboration records.

## Security and session architecture

1. GitHub OAuth uses a cryptographically random state value in an HttpOnly,
   SameSite cookie to prevent CSRF.
2. Access tokens are encrypted at rest in signed, HttpOnly sessions and are
   never exposed to client-side JavaScript or local storage.
3. Album and artwork writes require the library owner and current file SHA;
   stale writes return a conflict instead of overwriting newer content.
4. Issue and pull-request mutations require an authenticated GridCraft user.
   Issue edits are limited to the issue author or album owner; pull-request
   merges are limited to the base album owner and verify the stored file
   snapshots before applying changes.
5. Request logging redacts authorization, cookie, and OAuth credentials.

## Frontend structure

- `src/App.jsx`: application routes, auth, and view switching.
- `src/components/DashboardShell.jsx`: album folder listing and creation.
- `src/components/AlbumDetail.jsx`: album-level artwork, Story, branch, issue,
  pull-request, fork, and settings views.
- `src/components/StoriesTab.jsx` and `src/components/ArtworksTab.jsx`: nested
  Story and artwork management.
- `src/components/IssuesTab.jsx` and `src/components/PullRequestsTab.jsx`:
  GridCraft-owned collaboration interfaces.
- `src/components/ArtworkEditor.jsx` and `src/hooks/useArtworkEditor.js`:
  visual canvas editing and guarded saves.
- `src/services/apiClient.js`: credentialed client for the application API.

## Backend structure

- `server/src/controllers/`: HTTP request/response handling.
- `server/src/routes/`: authenticated API route definitions.
- `server/src/services/albumService.js`: shared repository setup, album folder
  CRUD/indexing, and folder-copy forks.
- `server/src/services/storyService.js` and `artworkService.js`: validated
  nested JSON storage and SHA-protected updates.
- `server/src/services/issueService.js` and `pullRequestService.js`: GridCraft
  collaboration workflows and guarded file merges.
- `server/src/services/appStore.js`: SQLite persistence for the album index,
  collaboration records, and file snapshots.
- `server/src/utils/crypto.js` and `middleware/auth.js`: session protection and
  token encryption.

SQLite runtime data is stored in `server/data/` by default and is excluded from
version control.
