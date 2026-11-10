# GridCraft --- Full-Stack GitHub for Pixel Art

## Product and Engineering Roadmap

**Current release:** `v3.9.0`\
**Roadmap target:** `v4.0.0`\
**Product direction:** A GitHub-inspired platform for creating,
organizing, versioning, sharing, and collaborating on pixel art.\
**Core principle:** GitHub repositories are the source of truth for
albums, stories, artworks, branches, issues, pull requests, and forks.
GridCraft is the visual interface that makes those Git concepts
accessible to pixel artists.

------------------------------------------------------------------------

# 0. Instructions for the implementation agent

You are working on the existing GridCraft project. Do not treat this as
a greenfield rewrite.

Before changing code:

1.  Inspect the complete repository, current branch, Git status, package
    files, components, hooks, utilities, tests, styles, and
    documentation.
2.  Confirm the current application version is `3.3.0`. The product
    owner identifies the current release as v3.3.0. If `package.json` or
    another version file disagrees, report the mismatch and make the
    project version consistent with `3.3.0` before starting the roadmap.
    Do not silently assume an older package version is correct.
3.  Map the existing editor's state and behavior. Preserve working
    functionality unless this plan explicitly replaces it.
4.  Identify the current Snap feature implementation, including
    `SnapsPanel`, `PresentationMode`, `useSnaps`, snapshot utilities,
    local persistence, export utilities, and related CSS/tests.
5.  Write a short implementation audit in the PR or development notes
    before making structural changes.
6.  Implement one roadmap release at a time. Do not skip ahead or
    implement every phase in one giant change.
7.  At the end of each release: run tests, lint if configured,
    production build, and manual smoke tests; update docs and version;
    summarize files changed, decisions, known limitations, and next
    phase.
8.  Never claim a feature is complete unless it works end-to-end against
    the actual GitHub API or a clearly identified mock/test environment.
9.  Do not replace real GitHub operations with hardcoded demo data in
    production paths.
10. Do not delete existing artwork or browser data as part of migration.
    Provide an export or migration path first.

If the repository's current architecture differs from this plan, adapt
the implementation while preserving the product requirements. Explain
material deviations instead of silently ignoring requirements.

## Non-negotiable product requirements

-   GitHub authentication.
-   Users can create and manage albums. An album is one GitHub
    repository.
-   Users can create, edit, rename, view, export, and delete artworks
    inside an album.
-   An artwork is a validated JSON file containing canvas dimensions,
    pixel cells, and metadata.
-   Albums contain stories. A story is a folder containing ordered
    artwork frames plus a story manifest.
-   Replace the current standalone Snap/storyboard system with
    album-owned Stories.
-   A Story can be previewed as a controlled slideshow and exported as a
    GIF.
-   Git branching must work. The default branch must be named `master`.
-   Users can create, switch, rename, and delete eligible branches, and
    compare branches.
-   Issues must support listing, viewing, creating, commenting, editing
    where permitted, and closing/reopening.
-   Pull requests must support listing, viewing, creating,
    reviewing/commenting where supported, and merging where the current
    user has permission.
-   Users can fork albums/repositories and open pull requests from their
    forks.
-   Public/private repository visibility must be respected.
-   GitHub permissions and repository access must be enforced by GitHub,
    not simulated by frontend checks.
-   No paid technology or paid API is required for local development or
    the core product.
-   Do not introduce MongoDB for artwork storage. Do not add a database
    unless a concrete requirement justifies it. A small local SQLite
    database may be used for secure sessions/token records if required
    by the chosen deployment architecture; it is not an artwork
    database.

------------------------------------------------------------------------

# 1. Product vision and terminology

GridCraft should feel like GitHub, but designed around pixel art rather
than source code.

  -----------------------------------------------------------------------
  GridCraft concept       GitHub concept          Meaning
  ----------------------- ----------------------- -----------------------
  Creator account         GitHub user             The authenticated
                                                  person using GridCraft

  Album                   Repository              A project that contains
                                                  pixel artworks and
                                                  stories

  Artwork                 JSON file               One editable pixel
                                                  canvas

  Story                   Folder + manifest       An ordered sequence of
                                                  artworks that can be
                                                  played as an animation

  Frame                   Artwork referenced by a One visual state in a
                          Story                   Story

  Branch                  Git branch              An independent line of
                                                  artwork development

  Commit                  Git commit              A saved change to
                                                  repository content

  Issue                   GitHub Issue            A task, bug, idea, or
                                                  discussion

  Pull request            GitHub Pull Request     A proposal to merge
                                                  changes from one
                                                  branch/fork into
                                                  another

  Fork                    GitHub fork             A separate copy of an
                                                  album repository

  Default branch          `master`                The main stable line of
                                                  work
  -----------------------------------------------------------------------

## Product experience

A typical user journey:

1.  A visitor opens GridCraft and chooses **Continue with GitHub**.
2.  The user authorizes GridCraft.
3.  The user creates an album named, for example, `minecraft-items`.
4.  GridCraft creates a GitHub repository for that album and ensures its
    default branch is `master`.
5.  The user opens the album and creates an artwork.
6.  GridCraft opens the existing pixel editor with a blank or loaded
    canvas.
7.  The user draws and saves. GridCraft writes the artwork JSON into the
    album repository and creates a Git commit.
8.  The user creates a Story called `diamond-sword-animation`.
9.  The user adds existing artworks as frames, orders them, adjusts
    frame durations, previews the slideshow, and exports a GIF.
10. The user creates a branch such as `feature/animated-sword`, makes
    changes, and opens a pull request into `master`.
11. Other users can discuss the work through Issues and Pull Requests,
    fork the album, and contribute their own changes.

## Product principles

-   GitHub is the canonical storage and collaboration engine.
-   GridCraft should not maintain a second copy of the full artwork data
    in a database.
-   The editor should remain responsive: drawing happens locally;
    network requests happen on load/save and explicit Git operations.
-   Every write should be attributable to the authenticated user and
    result in a meaningful commit.
-   The product should make Git concepts understandable to artists who
    may not know Git.
-   Do not hide important Git concepts. Show the current album, branch,
    save status, and commit history clearly.
-   Never overwrite remote work silently.

------------------------------------------------------------------------

# 2. Technology and cost constraints

## Recommended stack

  -----------------------------------------------------------------------
  Layer                   Technology              Cost/licensing
                                                  direction
  ----------------------- ----------------------- -----------------------
  Frontend                Existing React + Vite   Open-source
                          application             

  Styling                 Existing CSS and        No paid UI framework
                          component patterns      required

  Backend                 Node.js + Express       Open-source

  GitHub integration      GitHub App + GitHub     No paid GitHub API plan
                          REST API                required for normal
                                                  development; subject to
                                                  GitHub limits and terms

  GitHub API client       Octokit                 Open-source
                          (`@octokit/rest`)       

  Validation              Zod or an equivalent    Open-source
                          maintained schema       
                          validator               

  Session persistence, if SQLite                  Open-source; only for
  required                                        app session/token
                                                  metadata

  GIF encoding            `gifenc` or another     Open-source; verify
                          maintained,             current license and
                          permissively licensed   bundle behavior before
                          browser-compatible GIF  adoption
                          encoder                 

  Tests                   Vitest, React Testing   Open-source
                          Library, Node test      
                          runner, Supertest       

  Local development       Vite + Node + local     Free
                          SQLite (only if needed) 

  Version control         Git + GitHub            Free tier is sufficient
                                                  for development
  -----------------------------------------------------------------------

Do not add MongoDB for artwork files. Do not use paid image hosting,
paid animation APIs, paid auth providers, paid storage buckets, paid
analytics, or paid UI kits.

The application can be developed locally without paying for hosting.
Deployment may use free tiers, but free-tier limits, sleeping services,
persistent disk availability, and provider policies can change. Do not
promise permanent free production hosting. Document deployment
assumptions and never rely on an ephemeral filesystem for persistent
sessions.

## GitHub App, not a Personal Access Token workflow

Use a GitHub App with fine-grained permissions. Do not ask users to
paste Personal Access Tokens.

The backend must own all GitHub secrets: - GitHub App ID. - GitHub App
Client ID. - GitHub App Client Secret. - GitHub App private key. -
Webhook secret, if webhooks are implemented.

Store secrets in environment variables. Never put them in Vite
variables, frontend bundles, source control, browser localStorage, or
client-visible API responses.

Use GitHub App user authorization for sign-in and user-attributed
actions. Use the appropriate user access token or installation access
token for each operation, based on the endpoint and permissions. Do not
assume one token type can perform every operation. Verify the endpoint's
current GitHub App token support and required permissions before
implementing it.

Request the minimum required permissions, likely including: - Repository
metadata: read. - Repository contents: read/write. - Repository
administration or repository creation: only the permissions required to
create/manage albums and branches. - Issues: read/write. - Pull
requests: read/write. - Commit statuses/checks only if a later feature
actually needs them.

The exact GitHub App permission configuration must be validated against
the current endpoint documentation. If an operation needs a permission
not granted, show a clear reauthorization/install-permission message.

## Authentication and session safety

-   Use the GitHub App authorization flow with a cryptographically
    random `state` value to prevent CSRF.
-   Validate the callback state and authorization code on the backend.
-   Exchange the code on the backend only.
-   Fetch the authenticated GitHub user's identity from GitHub; do not
    trust a username supplied by the browser.
-   Use secure, HttpOnly, SameSite cookies for the application session.
-   Use HTTPS in production.
-   Protect state-changing app endpoints against CSRF.
-   Never store GitHub access tokens in localStorage or sessionStorage.
-   Encrypt refresh/access tokens at rest if they must be persisted.
-   If SQLite is used, store only app identity/session/token
    metadata---not artwork content.
-   Handle token expiration, refresh, revocation, and permission
    changes.
-   Implement logout and disconnect/revoke flows.
-   Do not log tokens, authorization codes, cookies, private keys, or
    full sensitive headers.
-   A logged-in user must never be able to access another user's private
    repository merely by changing an owner/repository string in a
    request.

------------------------------------------------------------------------

# 3. Repository and data format design

## Album repository structure

Create a predictable repository layout. Keep it readable in GitHub's
normal interface.

``` text
minecraft-items/
├── README.md
├── .gridcraft/
│   ├── album.json
│   └── schema-version.json
├── artworks/
│   ├── diamond-sword.json
│   ├── creeper.json
│   └── diamond-pickaxe.json
└── stories/
    ├── sword-swing/
    │   ├── story.json
    │   └── README.md
    └── creeper-explosion/
        ├── story.json
        └── README.md
```

Stories should reference artwork IDs/paths rather than duplicate the
complete pixel data. This keeps a single source of truth for each
artwork. A Story manifest controls the frame order, frame duration, loop
behavior, and other playback settings.

Branches, commits, issues, pull requests, and forks are native GitHub
repository features; do not recreate them in JSON.

## Album manifest: `.gridcraft/album.json`

Example:

``` json
{
  "format": "gridcraft-album",
  "schemaVersion": 1,
  "id": "stable-album-id",
  "name": "Minecraft Items",
  "description": "Pixel art assets inspired by Minecraft.",
  "createdAt": "2026-11-10T10:00:00.000Z",
  "updatedAt": "2026-11-10T10:00:00.000Z",
  "createdWith": {
    "name": "GridCraft",
    "version": "4.0.0"
  }
}
```

The repository owner, repository name, visibility, default branch, and
GitHub URL should be derived from GitHub's repository response rather
than trusted from this file.

## Artwork JSON format

The current editor already represents the canvas using: - `gridSize`
with supported sizes 16, 32, 64, and 128. - A flat `cells` array. -
`null` for transparent cells. - Hex color strings for painted cells. -
`backgroundColor` for the canvas background.

Preserve this model where possible.

Example:

``` json
{
  "format": "gridcraft-artwork",
  "schemaVersion": 1,
  "id": "diamond-sword",
  "name": "Diamond Sword",
  "description": "A pixel-art diamond sword.",
  "gridSize": 16,
  "width": 16,
  "height": 16,
  "backgroundColor": "transparent",
  "cells": [
    null,
    null,
    "#42a5f5"
  ],
  "createdAt": "2026-11-10T10:00:00.000Z",
  "updatedAt": "2026-11-10T10:00:00.000Z"
}
```

The example's `cells` array is abbreviated for readability. A real 16×16
canvas has exactly 256 cells; 32×32 has 1,024; 64×64 has 4,096; 128×128
has 16,384.

Validation requirements: - `format` must match. - `schemaVersion` must
be supported. - `id` must be stable and valid. - Name and description
must have sensible length limits. - Grid size must be one of the
supported sizes unless the editor deliberately adds more. -
`cells.length` must equal `gridSize * gridSize`. - Every cell must be
`null` or a valid normalized hex color. - Background must be
`transparent` or a valid hex color. - Reject malformed JSON, oversized
files, unsupported schema versions, and unexpected structures. - Do not
execute imported file content. - Use a safe, deterministic filename/slug
and prevent path traversal.

Do not store a separate RGB object for every pixel. Hex strings and
`null` are compact and compatible with the existing editor.

## Story folder and manifest

A Story is a folder inside `stories/`. The folder contains a
`story.json` manifest. The frames point to artwork files already present
in `artworks/`.

Example:

``` json
{
  "format": "gridcraft-story",
  "schemaVersion": 1,
  "id": "sword-swing",
  "name": "Sword Swing",
  "description": "A short sword animation.",
  "loop": true,
  "defaultFrameDurationMs": 150,
  "frames": [
    {
      "artworkId": "diamond-sword",
      "artworkPath": "artworks/diamond-sword.json",
      "durationMs": 150
    },
    {
      "artworkId": "diamond-sword-windup",
      "artworkPath": "artworks/diamond-sword-windup.json",
      "durationMs": 100
    },
    {
      "artworkId": "diamond-sword-hit",
      "artworkPath": "artworks/diamond-sword-hit.json",
      "durationMs": 250
    }
  ],
  "createdAt": "2026-11-10T10:00:00.000Z",
  "updatedAt": "2026-11-10T10:00:00.000Z"
}
```

A Story should initially require frames to have compatible dimensions so
playback and GIF export are predictable. If mixed dimensions are
supported later, define an explicit fit/crop/scale policy rather than
silently stretching artwork.

Story playback controls: - Play and pause. - Previous and next frame. -
Restart. - Loop on/off. - Adjustable playback speed or per-frame
duration. - Timeline/frame strip. - Reorder frames. - Add/remove
frames. - Show the current frame number. - Preview at crisp pixel
scaling. - Export the selected Story as a `.gif`. - GIF export must use
a real GIF encoder. Do not rename a WebM file to `.gif`. - Keep GIF
generation in the browser where practical, so no paid media-conversion
service is needed. - Clearly report encoder errors and export
progress. - Respect frame durations and loop settings in the generated
GIF.

------------------------------------------------------------------------

# 4. Architecture

## High-level system

``` text
Browser
  |
  | HTTPS / JSON
  v
React + Vite frontend
  |
  | same-origin /api requests
  v
Node.js + Express backend
  |
  | GitHub App authentication and authorized API calls
  v
GitHub REST API
  |
  +-- User identity
  +-- Album repositories
  +-- Artwork JSON files
  +-- Story folders/manifests
  +-- Branches and commits
  +-- Issues
  +-- Pull requests
  +-- Forks
```

The frontend must not call private GitHub endpoints with a secret or raw
token. Route authenticated operations through the backend.

## Backend responsibilities

-   Authentication and session management.
-   GitHub API client creation and token refresh.
-   User identity and authorization checks.
-   Album/repository creation and discovery.
-   Artwork JSON validation, read, create, update, delete, and rename.
-   Story manifest validation and CRUD.
-   Branch and commit operations.
-   Issue operations.
-   Pull request operations.
-   Fork operations.
-   Rate-limit and error handling.
-   Audit-friendly structured logs without secrets.

## Frontend responsibilities

-   Preserve and extend the existing drawing editor.
-   Add authenticated navigation and account menu.
-   Add dashboard, album pages, artwork pages, Story editor/player,
    branches, Issues, Pull Requests, and fork workflows.
-   Display clear loading, empty, error, permission, conflict, and
    success states.
-   Keep canvas interaction local and fast.
-   Track dirty/unsaved changes.
-   Ask before destructive operations.
-   Never claim a save succeeded before the backend confirms GitHub
    accepted it.

## Suggested folder structure

Adapt this to the current project instead of moving every file
unnecessarily.

``` text
gridcraft/
├── src/
│   ├── app/
│   ├── components/
│   ├── pages/
│   │   ├── LandingPage/
│   │   ├── DashboardPage/
│   │   ├── AlbumPage/
│   │   ├── ArtworkEditorPage/
│   │   ├── StoryEditorPage/
│   │   ├── BranchesPage/
│   │   ├── IssuesPage/
│   │   └── PullRequestsPage/
│   ├── features/
│   │   ├── auth/
│   │   ├── albums/
│   │   ├── artworks/
│   │   ├── stories/
│   │   ├── branches/
│   │   ├── issues/
│   │   ├── pullRequests/
│   │   └── forks/
│   ├── editor/
│   │   ├── Grid.jsx
│   │   ├── Tools.jsx
│   │   └── existing editor utilities
│   ├── services/
│   │   └── apiClient.js
│   ├── hooks/
│   ├── utils/
│   └── styles/
│
├── server/
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       │   ├── github/
│       │   ├── albums/
│       │   ├── artworks/
│       │   ├── stories/
│       │   ├── branches/
│       │   ├── issues/
│       │   ├── pullRequests/
│       │   └── forks/
│       ├── validators/
│       ├── utils/
│       └── app.js
│
├── shared/
│   └── schemas/
├── tests/
├── docs/
├── .env.example
└── PLAN.md
```

Use shared validation schemas only if the current build setup can share
them cleanly. Avoid premature monorepo complexity.

------------------------------------------------------------------------

# 5. API design

All application endpoints should be versioned under `/api/v1`. Use
consistent JSON responses and meaningful HTTP status codes.

Suggested endpoints (adapt names if existing conventions are better):

## Authentication

-   `GET /api/v1/auth/github` --- start GitHub authorization.
-   `GET /api/v1/auth/github/callback` --- validate state, exchange
    code, establish session.
-   `GET /api/v1/auth/me` --- return the authenticated GridCraft user.
-   `POST /api/v1/auth/logout` --- clear session.
-   `POST /api/v1/auth/disconnect` --- disconnect/revoke where
    supported.

## Albums

-   `GET /api/v1/albums` --- list albums accessible to the user, with
    pagination.
-   `POST /api/v1/albums` --- create a GitHub repository and initialize
    it as a GridCraft album.
-   `GET /api/v1/albums/:owner/:repo` --- fetch repository and album
    metadata.
-   `PATCH /api/v1/albums/:owner/:repo` --- update supported
    repository/album metadata.
-   `DELETE /api/v1/albums/:owner/:repo` --- only if explicitly
    implemented; require confirmation and explain that this deletes a
    GitHub repository.
-   `GET /api/v1/albums/:owner/:repo/tree` --- list relevant GridCraft
    files.
-   `GET /api/v1/albums/:owner/:repo/commits` --- list commit history.

## Artworks

-   `GET /api/v1/albums/:owner/:repo/artworks`
-   `POST /api/v1/albums/:owner/:repo/artworks`
-   `GET /api/v1/albums/:owner/:repo/artworks/:artworkId`
-   `PUT /api/v1/albums/:owner/:repo/artworks/:artworkId`
-   `DELETE /api/v1/albums/:owner/:repo/artworks/:artworkId`
-   `PATCH /api/v1/albums/:owner/:repo/artworks/:artworkId` ---
    rename/move metadata only if supported.

For writes, include the target branch and expected file SHA where
applicable. Return the new commit SHA, file SHA, and updated path. Use
the SHA to detect stale writes and prevent lost updates.

## Stories

-   `GET /api/v1/albums/:owner/:repo/stories`
-   `POST /api/v1/albums/:owner/:repo/stories`
-   `GET /api/v1/albums/:owner/:repo/stories/:storyId`
-   `PUT /api/v1/albums/:owner/:repo/stories/:storyId`
-   `DELETE /api/v1/albums/:owner/:repo/stories/:storyId`
-   `POST /api/v1/albums/:owner/:repo/stories/:storyId/frames`
-   `PATCH /api/v1/albums/:owner/:repo/stories/:storyId/frames/order`

Story manifest updates must use the current file SHA and a meaningful
commit message.

## Branches

-   `GET /api/v1/albums/:owner/:repo/branches`
-   `POST /api/v1/albums/:owner/:repo/branches`
-   `GET /api/v1/albums/:owner/:repo/branches/:branch`
-   `DELETE /api/v1/albums/:owner/:repo/branches/:branch`
-   `GET /api/v1/albums/:owner/:repo/compare/:base...:head`

Do not allow deletion of the default branch. Respect GitHub branch
protection and permissions.

## Issues

-   `GET /api/v1/albums/:owner/:repo/issues`
-   `POST /api/v1/albums/:owner/:repo/issues`
-   `GET /api/v1/albums/:owner/:repo/issues/:number`
-   `PATCH /api/v1/albums/:owner/:repo/issues/:number`
-   `POST /api/v1/albums/:owner/:repo/issues/:number/comments`

GitHub's Issues API can return pull requests in issue-shaped responses.
Filter or label results correctly so the Issues page does not show PRs
as ordinary issues.

## Pull requests

-   `GET /api/v1/albums/:owner/:repo/pulls`
-   `POST /api/v1/albums/:owner/:repo/pulls`
-   `GET /api/v1/albums/:owner/:repo/pulls/:number`
-   `PATCH /api/v1/albums/:owner/:repo/pulls/:number`
-   `POST /api/v1/albums/:owner/:repo/pulls/:number/reviews`
-   `PUT /api/v1/albums/:owner/:repo/pulls/:number/merge`

Only expose actions that the authenticated user is permitted to perform.
Merge must show base/head, title, changed files/commits, and
mergeability before confirmation.

## Forks

-   `POST /api/v1/albums/:owner/:repo/forks`
-   `GET /api/v1/forks` --- list the current user's forks or fork
    relationships as supported.
-   Provide navigation to the forked repository and its default branch.

Use pagination for all list endpoints. Do not fetch every repository,
branch, issue, or commit in one unbounded request.

------------------------------------------------------------------------

# 6. Versioning policy

Use Semantic Versioning: `MAJOR.MINOR.PATCH` (`x.y.z`).

-   **MAJOR (`x`)**: A breaking change to the product's public behavior,
    data format, architecture, or compatibility; or a major stable
    product generation. Example: the full GitHub-native platform launch
    from v3 to v4. A major version is not increased for every large
    feature.
-   **MINOR (`y`)**: A backward-compatible feature release. New
    user-facing capabilities, pages, APIs, or integrations increase the
    minor version.
-   **PATCH (`z`)**: Backward-compatible bug fixes, small UI fixes,
    security fixes, documentation corrections, and internal changes that
    do not add a significant feature.

Rules: 1. Start from `3.3.0`. 2. Each roadmap phase below is a minor
release unless stated otherwise. 3. Increment patch versions during work
only for standalone patch releases; do not invent patch releases for
unfinished phases. 4. Do not increment the major version until the
v4.0.0 release criteria are met. 5. Keep `package.json`, app version
display, changelog, and release tag consistent. 6. Every release must
have a changelog entry. 7. If a change breaks a previously supported
data format or public API, either provide a migration/compatibility
layer or treat it as a major version change.

------------------------------------------------------------------------

# 7. Version-by-version implementation roadmap

## v3.4.0 --- Foundation, architecture audit, and GitHub authentication

**Goal:** Establish the full-stack foundation and allow users to sign in
with GitHub. No album or artwork repository operations should be added
until authentication is reliable.

### Work

1.  Audit the existing frontend and preserve the drawing editor.
2.  Add the Node.js + Express backend in a clearly separated server
    directory.
3.  Add local development scripts to run frontend and backend together.
4.  Add environment variable loading and `.env.example`.
5.  Configure a GitHub App for development.
6.  Implement GitHub App user authorization with state validation.
7.  Implement callback handling and authenticated user lookup.
8.  Implement secure session cookies, logout, token refresh/revocation
    handling as applicable.
9.  Add `GET /api/v1/auth/me`.
10. Add frontend authentication state and protected routes.
11. Add a signed-in account menu showing GitHub avatar, username,
    profile link, and logout.
12. Add clear unauthenticated, loading, expired-session, and
    permission-error states.
13. Add backend health endpoint for local development.
14. Add basic API error format and request logging that redacts secrets.

### UI expectations

-   Landing page remains recognizably GridCraft.
-   Add **Continue with GitHub**.
-   After login, show a dashboard shell, even if empty.
-   Show the authenticated user's GitHub avatar and username.
-   Do not show fake repositories or demo artwork as if they were real.

### Acceptance criteria

-   A real GitHub account can authorize the development GitHub App.
-   Callback rejects missing/invalid state.
-   Frontend can retrieve the current user from the backend.
-   Refreshing the page preserves the session safely.
-   Logout clears the session.
-   No access token, refresh token, client secret, or private key
    appears in frontend code, browser storage, logs, or Git history.
-   Existing editor drawing, undo/redo, image import, PNG export, and
    theme behavior still work.
-   Tests cover auth state validation, callback errors, session
    behavior, and protected routes.

### Antigravity execution prompt

> Implement v3.4.0 only. First audit the repository and report the
> existing architecture and risks. Add a Node/Express backend and GitHub
> App authentication using secure server-side handling. Preserve the
> current GridCraft editor and its behavior. Do not implement albums,
> artworks, stories, branches, issues, or pull requests yet. Do not
> expose secrets to the browser. Add tests, `.env.example`, local
> development scripts, and documentation. Verify the real GitHub
> authorization flow using configured development credentials; if
> credentials are unavailable, implement testable integration boundaries
> and clearly mark the live flow as unverified. Finish with a production
> build and a v3.4.0 changelog entry.

------------------------------------------------------------------------

## v3.5.0 --- Albums as GitHub repositories

**Goal:** A user can create, browse, open, and manage albums. Every
album is a real GitHub repository.

### Work

1.  Add the Albums dashboard.
2.  Add **Create album** form:
    -   Name.
    -   Description.
    -   Public/private visibility.
    -   Optional README.
3.  Validate repository name and handle GitHub's naming/availability
    errors.
4.  Create the repository through the authenticated GitHub API.
5.  Initialize the repository with `.gridcraft/album.json`, `artworks/`,
    and `stories/`.
6.  Ensure the default branch is named `master`.
    -   Do not assume the user's GitHub account default branch is
        `master`.
    -   Detect the actual initial branch.
    -   Rename it or initialize the repository so that `master` exists.
    -   Verify the repository's `default_branch` is `master` before
        reporting album creation success.
    -   Handle a failed rename/default-branch operation without leaving
        the user with a falsely successful album.
7.  Add album cards with repository name, description, visibility,
    owner, updated time, and GitHub link.
8.  Add album detail page with tabs or navigation for Overview,
    Artworks, Stories, Branches, Issues, and Pull Requests. Tabs for
    features not yet released may be disabled or marked as coming soon;
    do not make them look functional.
9.  Add open-in-GitHub action.
10. Add repository pagination and loading/error/empty states.
11. Allow users to connect/import an existing repository as an album
    only if it contains a valid GridCraft manifest; otherwise offer a
    safe initialization flow.
12. Add archive/delete behavior only with explicit confirmation and
    clear warnings. Deleting a repository is destructive and should not
    be the default action.

### Repository initialization

Use a meaningful initial commit, for example:

`chore(gridcraft): initialize album`

The README should explain that the repository is a GridCraft album and
how its folders are organized.

### Acceptance criteria

-   Creating an album creates a real GitHub repository under the
    authenticated user's account.
-   User can choose public or private.
-   The repository contains a valid album manifest and expected
    directories.
-   `master` is the verified default branch.
-   Dashboard lists the user's accessible albums with pagination.
-   Private albums are visible only to users who have GitHub access.
-   A user cannot open another user's private album by editing the URL.
-   Failed repository creation or initialization is reported accurately
    and can be recovered safely.

### Antigravity execution prompt

> Implement v3.5.0 only. Build Albums as real GitHub repositories. Add
> the album dashboard, create-album flow, public/private selection,
> repository initialization, album manifest, and album detail shell.
> Enforce `master` as the verified default branch regardless of the
> GitHub account's configured default branch. Use GitHub API responses
> as the source of truth. Do not store artwork in a database. Add tests
> for repository initialization, permission failures, duplicate names,
> and branch initialization. Preserve the existing editor.

------------------------------------------------------------------------

## v3.6.0 --- Artwork files and Git-backed editor

**Goal:** Users can create and manage artworks in an album, with the
existing GridCraft canvas as the editor.

### Work

1.  Add an Artworks tab to album pages.
2.  List artwork JSON files from the repository's `artworks/` folder.
3.  Render artwork thumbnails using the same pixel data model as the
    editor.
4.  Add **New artwork**.
5.  Add artwork metadata form:
    -   Name.
    -   Description.
    -   Grid size.
6.  Open the existing editor for a new or existing artwork.
7.  Add a persistence adapter between editor state and the backend.
8.  Load artwork JSON into `gridSize`, `cells`, and `backgroundColor`.
9.  Save artwork JSON through the backend.
10. Create a meaningful Git commit for each explicit save.
11. Add dirty/unsaved state and a save indicator.
12. Add save progress, success, and error states.
13. Add rename and delete operations with confirmation.
14. Add PNG export and retain image import.
15. Add commit history for an artwork where possible by querying the
    file's commit history.
16. Implement optimistic concurrency using the current file SHA.
17. If the remote file has changed since it was loaded, stop the write
    and show a conflict UI:
    -   Reload remote.
    -   Compare/inspect the remote version.
    -   Save as a new artwork or branch.
    -   Never silently overwrite remote changes.
18. Avoid a Git commit for every painted pixel. Drawing remains local;
    save is explicit. If autosave is later introduced, debounce it and
    avoid duplicate commits.

### Commit message conventions

Examples: - `feat(artwork): add diamond-sword` -
`update(artwork): refine creeper face` -
`rename(artwork): diamond-sword to enchanted-sword` -
`delete(artwork): remove draft-pickaxe`

### Acceptance criteria

-   User can create, open, edit, save, rename, and delete artwork JSON
    files.
-   16×16, 32×32, 64×64, and 128×128 data round-trip without pixel
    changes.
-   Transparent cells remain transparent.
-   Background color is preserved.
-   Existing editor tools continue working.
-   A successful save creates a GitHub commit and updates the local SHA.
-   Stale SHA conflicts never silently overwrite remote work.
-   Invalid or oversized JSON is rejected with a useful error.
-   Public/private permissions are enforced by GitHub and backend
    authorization.

### Antigravity execution prompt

> Implement v3.6.0 only. Integrate the existing GridCraft canvas with
> GitHub-backed artwork JSON files. Preserve the existing drawing tools,
> undo/redo, image import, PNG export, grid sizes, transparency, and
> background color. Add artwork CRUD, JSON validation, thumbnails,
> explicit saves, meaningful commit messages, and SHA-based conflict
> detection. Do not store pixel arrays in MongoDB or another database.
> Test exact pixel-data round trips at every supported grid size and
> test stale-write conflicts.

------------------------------------------------------------------------

## v3.7.0 --- Stories replace Snaps and add GIF export

**Goal:** Remove the current standalone Snap feature and replace it with
Stories inside albums. A Story is a folder of artwork references and
playback metadata.

### Existing functionality to replace

The current project has a Snap system with a Snaps panel, `useSnaps`,
`PresentationMode`, snapshot thumbnails, local browser persistence,
snapshot JSON import/export, and WebM export.

Do not simply rename the Snap panel. Replace its product model:

-   A Snap is no longer a top-level saved canvas item.
-   A Story belongs to an album.
-   A Story contains references to artwork files in that album.
-   A Story's order and frame durations live in
    `stories/<story-slug>/story.json`.
-   Artwork remains the source of truth for pixel data.
-   Story playback reads the referenced artworks and renders them in
    sequence.
-   GIF export produces a real `.gif` file.

### Migration and removal strategy

1.  Audit all Snap-related components, hooks, CSS, utilities, tests, and
    local storage keys.
2.  Add an export/migration option before removing the old feature.
3.  Allow users to export existing Snap data as a backup.
4.  Provide a migration wizard or utility that can:
    -   Read the existing Snap export format.
    -   Create artwork files for each valid Snap in a selected album.
    -   Create a Story manifest referencing those artworks in the
        original sequence.
    -   Preserve titles, captions/notes where relevant, frame durations,
        and order.
5.  Validate migrated data before writing it to GitHub.
6.  Never silently delete local Snap data. Keep a backup until migration
    is confirmed.
7.  After migration is available and tested, remove the old standalone
    Snap UI and obsolete local-only presentation workflow.
8.  Remove obsolete utilities only after confirming no other feature
    uses them.
9.  Update the manual, README, tests, and screenshots to describe
    Stories.

### Story UI

Inside an album, add a Stories section.

Story card: - Story thumbnail/preview. - Name and description. - Number
of frames. - Updated date. - Play preview. - Edit Story.

Story editor: - Story title and description. - Artwork picker from the
current album. - Add/remove frames. - Drag-and-drop reorder. - Per-frame
duration. - Default frame duration. - Loop toggle. - Preview timeline. -
Play, pause, previous, next, restart. - Save Story. - Export GIF.

### GIF export

-   Use a maintained, open-source browser-compatible encoder such as
    `gifenc` after verifying its license and compatibility.
-   Do not use paid conversion APIs.
-   Do not export WebM and rename the extension to `.gif`.
-   Render each artwork to an offscreen canvas at a suitable integer
    scale.
-   Preserve crisp pixel edges and transparency where supported by the
    encoder/output format.
-   Convert each frame using the configured duration.
-   Respect loop settings.
-   Show export progress and allow cancellation if practical.
-   Handle browser memory constraints and set a documented reasonable
    frame/pixel limit.
-   If source frames have different dimensions, initially reject the
    Story or require the user to normalize them; do not silently distort
    frames.
-   Test the output by decoding the GIF and verifying frame count,
    dimensions, order, and delays.

### Acceptance criteria

-   Stories can only be created inside an album.
-   Story manifests live in the repository's `stories/` folder.
-   Stories reference existing artwork paths/IDs; they do not duplicate
    artwork pixel arrays.
-   User can add, remove, reorder, and time frames.
-   Playback controls work reliably.
-   GIF export creates a valid animated GIF, not WebM.
-   Story saves create Git commits.
-   Existing Snap data has a safe backup/migration path.
-   The old standalone Snap feature is removed only after
    migration/export behavior is tested.

### Antigravity execution prompt

> Implement v3.7.0 only. Replace GridCraft's standalone Snap system with
> album-owned Stories. First inspect every Snap-related component, hook,
> local-storage key, utility, export path, and test. Preserve user data
> by implementing a backup and migration path from the existing Snap
> JSON format. A Story is a folder with a story.json manifest
> referencing artwork files in the same album. Build a reorderable frame
> editor, controlled slideshow player, per-frame timing, looping, and
> real GIF export using a free/open-source browser-compatible encoder.
> Do not rename WebM to GIF. Remove obsolete Snap UI and code only after
> migration tests pass.

------------------------------------------------------------------------

## v3.8.0 --- Branching and commit history

**Goal:** Introduce Git branches as a first-class GridCraft workflow.

### Work

1.  Add branch selector to the album and artwork editor.
2.  Show current branch prominently.
3.  Show `master` as the default branch.
4.  List branches with pagination.
5.  Create a branch from a selected base branch.
6.  Switch branches.
7.  Load artworks and Stories from the selected branch, not always from
    `master`.
8.  Save new artwork, updates, and Story manifests to the selected
    branch.
9.  Add branch rename where GitHub supports it and permissions allow it.
10. Add branch deletion with confirmation; prevent deletion of the
    default branch.
11. Add compare view for base and head branches.
12. Show commit history and commit details.
13. Show changed files where available.
14. Add a dirty-work warning when switching branches.
15. Never silently discard unsaved local canvas changes.
16. Handle a branch that was deleted or renamed remotely.
17. Respect branch protection rules and GitHub permission errors.

### Default branch policy

-   The default branch is `master`.
-   New albums must initialize or rename their initial branch so
    `master` is the default.
-   Branch selector must identify the default branch.
-   Pull requests should default their base branch to `master`, but
    allow another base branch if the user has permission and explicitly
    selects it.
-   Do not hardcode all writes to `master`; writes must target the
    selected branch.

### Acceptance criteria

-   User can create a branch from `master` or another branch.
-   User can switch branches and sees the correct branch-specific
    artwork and Story content.
-   Saves go to the currently selected branch.
-   The branch selector reflects GitHub's actual branch list.
-   Dirty changes trigger a save/discard/cancel decision before
    switching.
-   Default branch cannot be deleted through GridCraft.
-   Compare view shows GitHub's actual comparison, not a fabricated
    diff.

### Antigravity execution prompt

> Implement v3.8.0 only. Add real GitHub branch management and commit
> history. Enforce `master` as the album default branch, but allow users
> to create and work on feature branches. All artwork and Story
> reads/writes must use the selected branch. Add branch creation,
> switching, eligible rename/deletion, comparison, and dirty-state
> protection. Do not simulate Git branches in frontend state. Test
> branch-specific reads/writes and protected/default branch behavior.

------------------------------------------------------------------------

## v3.9.0 --- Issues

**Goal:** Add GitHub Issues inside GridCraft so album contributors can
track bugs, ideas, tasks, and artwork feedback without leaving the
platform.

### Work

1.  Add Issues tab to album page.
2.  List open and closed issues.
3.  Add filters for state, author, assignee, label, and search where
    supported.
4.  Add issue detail page/drawer.
5.  Create issue with title and Markdown body.
6.  Add comments.
7.  Edit title/body where permitted.
8.  Close and reopen issues.
9.  Show author avatar, labels, assignees, timestamps, and GitHub issue
    number.
10. Link an issue to an artwork or Story using a normal GitHub
    URL/reference in the body; optional structured linking can be added
    later.
11. Add open-in-GitHub action.
12. Use GitHub's issue pagination.
13. Distinguish Issues from Pull Requests. GitHub's issue listing can
    include pull-request-shaped items; filter these correctly.
14. Render Markdown safely. Sanitize HTML and prevent script execution.
15. Respect repository permissions.

### Acceptance criteria

-   User can list, create, view, comment on, close, and reopen issues
    when permitted.
-   Issue data is fetched from GitHub.
-   Private repository issues remain private.
-   Pagination and API error handling work.
-   Pull requests are not incorrectly displayed as ordinary issues.
-   Markdown content is rendered safely.

### Antigravity execution prompt

> Implement v3.9.0 only. Build a complete GitHub-backed Issues
> experience within each album. Support listing/filtering, creating,
> viewing, commenting, editing where permitted, closing/reopening,
> pagination, labels, and assignees where available. Use the real GitHub
> Issues API. Correctly exclude pull-request items from ordinary issue
> lists. Sanitize Markdown rendering. Do not create a parallel local
> issue database.

------------------------------------------------------------------------

## v3.10.0 --- Pull requests and reviews

**Goal:** Users can propose and review changes to artwork albums through
real GitHub Pull Requests.

### Work

1.  Add Pull Requests tab.
2.  List open, closed, and merged PRs.
3.  Add PR creation form:
    -   Title.
    -   Description/body.
    -   Head branch.
    -   Base branch (default `master`).
4.  Support PRs from branches in the same repository.
5.  Support PRs from forks.
6.  Display PR author, state, base/head branches, timestamps, commits,
    and changed files.
7.  Add conversation/comments view.
8.  Add review submission where supported:
    -   Comment.
    -   Approve.
    -   Request changes.
9.  Display mergeability and merge status from GitHub.
10. Add merge action with confirmation.
11. Support allowed merge methods exposed by the repository.
12. Show conflicts and permission restrictions clearly.
13. Link PRs to Issues using GitHub's native conventions.
14. Add open-in-GitHub action.
15. Ensure the PR base defaults to `master`.
16. Do not auto-merge without an explicit user action.

### Pixel-art-aware PR presentation

Where possible, inspect changed JSON artwork files and render: - Base
version preview. - Proposed version preview. - Side-by-side
comparison. - Changed artwork metadata. - Story manifest changes.

For v3.10.0, a clear file list and valid GitHub PR data are mandatory.
Visual pixel diff is a stretch goal only if it can be implemented
reliably without delaying core PR behavior.

### Acceptance criteria

-   User can create a PR from a branch into `master`.
-   User can view PR details and comments.
-   User can submit a review if GitHub permissions allow.
-   User can merge only when GitHub reports the PR can be merged and the
    user has permission.
-   Fork-based PRs are supported.
-   PR status is always sourced from GitHub.
-   Merge errors and conflicts are shown without losing local work.

### Antigravity execution prompt

> Implement v3.10.0 only. Add GitHub-backed Pull Requests, including
> list/detail/create, same-repository branch comparisons, fork-based
> PRs, conversation, reviews where permitted, and explicit merge
> confirmation. Default the base branch to `master`. Show actual GitHub
> mergeability and permission state. Add artwork previews for changed
> JSON files if feasible, but prioritize correct PR behavior. Never fake
> a merged state or silently merge.

------------------------------------------------------------------------

## v3.11.0 --- Forking and contribution workflow

**Goal:** Make albums forkable so creators can remix artwork and
contribute changes upstream.

### Work

1.  Add **Fork album** action to public albums and accessible
    repositories.
2.  Call GitHub's real fork endpoint.
3.  Show fork creation progress and resulting owner/repository.
4.  Redirect the user to the forked album.
5.  Detect upstream repository relationship.
6.  Show upstream owner/repository on forked album pages.
7.  Allow the user to create branches in their fork.
8.  Allow editing artwork and Stories in the fork.
9.  Add **Contribute upstream** / **Open pull request** action.
10. Create a PR from the fork branch to the upstream repository.
11. Show upstream changes and compare status where GitHub supports it.
12. Handle private repositories and fork permissions correctly.
13. Do not copy a repository manually and label it a fork. Use GitHub's
    actual fork relationship.
14. Explain that a fork belongs to the user's GitHub account and is
    governed by GitHub permissions.

### Acceptance criteria

-   Fork action creates a real GitHub fork.
-   GridCraft opens the forked repository.
-   Fork relationship and upstream repository are visible.
-   User can create artwork changes in their fork.
-   User can open a PR to the upstream album.
-   Permission failures are handled accurately.
-   Public/private access follows GitHub rules.

### Antigravity execution prompt

> Implement v3.11.0 only. Add real GitHub repository forking and
> upstream contribution workflows. Use GitHub's fork API and preserve
> the native fork relationship. Display upstream information, allow
> edits in the fork, and create pull requests from fork branches to
> upstream branches. Do not simulate forks by copying files into a new
> unrelated repository. Test fork creation, access restrictions, and
> fork-to-upstream PR creation.

------------------------------------------------------------------------

## v4.0.0 --- GitHub for Pixel Art: stable platform release

**Goal:** Consolidate the features into a coherent, tested, documented
product.

### Work

1.  Review all routes and navigation.
2.  Ensure a consistent album-centric user experience.
3.  Add robust loading, empty, error, permission, conflict, and offline
    states.
4.  Review accessibility and keyboard navigation.
5.  Review responsive behavior without compromising the desktop pixel
    editor.
6.  Add a complete onboarding flow.
7.  Add account settings and GitHub connection status.
8.  Add public album/profile pages only where privacy is respected.
9.  Add clear album visibility indicators.
10. Add artwork/story links that can be shared safely.
11. Add commit/save status everywhere a write can occur.
12. Add request pagination, caching, and conditional requests where
    appropriate.
13. Add GitHub API rate-limit handling and exponential backoff for safe
    retryable operations.
14. Add webhook support only if needed for reliable synchronization;
    validate webhook signatures.
15. Add comprehensive tests and end-to-end smoke tests.
16. Review token handling, CSRF, XSS, path validation, Markdown
    sanitization, and authorization.
17. Update README, Manual, architecture docs, API docs, `.env.example`,
    and deployment instructions.
18. Add a migration guide from v3.3.0 and the Snap-to-Story migration
    guide.
19. Verify that all core functionality works against real GitHub
    repositories.
20. Create the `v4.0.0` release tag only after acceptance criteria pass.

### v4.0.0 release acceptance criteria

-   GitHub sign-in and logout work.
-   Albums are real repositories.
-   Every album has `master` as its default branch.
-   Artwork files are valid JSON and round-trip without pixel loss.
-   Stories are album folders referencing artwork files.
-   Story slideshow controls work.
-   GIF export produces a valid animated GIF.
-   Branches and commits are real Git operations.
-   Issues are real GitHub Issues.
-   Pull Requests are real GitHub Pull Requests.
-   Forks are real GitHub forks.
-   Fork-to-upstream PRs work.
-   No paid service is required for local development or the core
    functionality.
-   No GitHub secrets are exposed to the frontend.
-   Private repository data is not leaked.
-   No silent overwrites or destructive data loss.
-   Existing editor features remain functional.
-   Documentation and changelog reflect the shipped product.

### Antigravity execution prompt

> Prepare GridCraft v4.0.0 for release. Do not add speculative features.
> Audit every completed roadmap capability against its acceptance
> criteria using real GitHub API behavior. Fix integration gaps,
> security issues, data-loss risks, navigation inconsistencies, and
> documentation. Verify Snap-to-Story migration, `master` default branch
> behavior, artwork round-trips, Story playback/GIF output, branches,
> Issues, PRs, forks, and fork-to-upstream contribution. Run all
> automated tests and a production build. Produce a release readiness
> report with passed, failed, and unverified items. Do not tag v4.0.0
> while any critical requirement is unverified or failing.

------------------------------------------------------------------------

# 8. Cross-cutting engineering requirements

These apply to every version.

## GitHub API correctness

-   Use the official GitHub REST API through Octokit where practical.
-   Pin or explicitly configure the supported GitHub API version header.
-   Check current endpoint documentation before implementing each
    endpoint.
-   Respect each endpoint's supported token types and fine-grained
    permissions.
-   Use pagination.
-   Use the current file SHA for Contents API updates/deletes.
-   Use branch/ref APIs for branch operations.
-   Use native Issues, Pull Requests, and Fork APIs.
-   Do not assume a successful HTTP response means the intended
    repository state is complete; verify important multi-step
    initialization operations.
-   Never store or expose GitHub tokens in frontend state or browser
    storage.
-   Do not create commits for every drawing action.
-   Use clear commit messages.
-   Handle 401, 403, 404, 409, 422, 429, and 5xx responses explicitly.
-   For rate limits, read GitHub rate-limit headers and `Retry-After`
    where present. Back off rather than retrying rapidly.
-   Do not automatically retry non-idempotent create/merge operations
    without checking whether the first request succeeded.
-   Treat GitHub's API as the source of truth for branches, commits,
    issues, PRs, forks, permissions, and repository visibility.

## Concurrency and conflict handling

-   Artwork updates must include the expected current file SHA.
-   Story manifest updates must include the expected current file SHA.
-   If the SHA changed, return a conflict response and let the user
    reload, compare, save as a new file, or switch branch.
-   Never silently force-push or overwrite.
-   Warn users before branch switching with dirty local changes.
-   A network failure must not clear the user's unsaved canvas state.
-   Preserve a local recovery draft when a save fails, but do not treat
    that draft as canonical repository storage.

## Validation and security

-   Validate all incoming request parameters and JSON bodies on the
    backend.
-   Validate artwork and Story manifests before writing.
-   Normalize repository paths and prevent path traversal.
-   Restrict filenames and slugs.
-   Sanitize Markdown output.
-   Avoid rendering untrusted raw HTML.
-   Apply CSRF protection to cookie-authenticated state-changing
    endpoints.
-   Use rate limiting for GridCraft's own backend endpoints.
-   Use secure cookies in production.
-   Configure CORS narrowly; prefer same-origin frontend/backend
    routing.
-   Keep secrets in environment variables.
-   Redact credentials from logs.
-   Verify webhook signatures if webhooks are used.
-   Check repository access on every request; do not trust
    frontend-supplied owner/repo values alone.
-   Never reveal private repository metadata in public pages, search
    results, errors, or logs.

## Reliability and user experience

-   Show clear save state: `Unsaved`, `Saving`, `Saved`, `Conflict`, or
    `Save failed`.
-   Keep drawing operations local and fast.
-   Disable duplicate submit actions while a request is in progress.
-   Show useful errors rather than raw stack traces.
-   Keep user work intact after a failed request.
-   Add confirmation for repository deletion, artwork deletion, Story
    deletion, branch deletion, and PR merging.
-   Add empty states with useful next actions.
-   Add skeleton/loading states for repository and GitHub data.
-   Use optimistic UI only when rollback is implemented.
-   Do not show placeholder/demo content in production as if it were
    real.

------------------------------------------------------------------------

# 9. Testing strategy

## Unit tests

-   Artwork schema validation.
-   Story schema validation.
-   Grid serialization/deserialization.
-   Path and slug validation.
-   Branch name validation.
-   GitHub error normalization.
-   GIF frame timing and ordering logic.
-   Snap-to-Story migration parser.
-   Session state validation.

## Backend integration tests

Mock GitHub at the service boundary for deterministic tests, and
maintain a separate manual integration checklist against a real test
repository.

Test: - Auth callback success/failure. - Invalid state rejection. -
Expired/revoked token. - Album creation and initialization. - `master`
branch verification. - Artwork create/read/update/delete. - SHA
conflict. - Story create/update/delete. - Branch create/switch/delete
restrictions. - Issue create/comment/close. - PR create/review/merge
permission handling. - Fork creation and upstream PR. - Pagination and
rate-limit errors.

Do not use mocks as proof that live GitHub integration works. Clearly
distinguish mocked tests from real integration verification.

## Frontend tests

-   Authenticated/unauthenticated navigation.
-   Album dashboard and create flow.
-   Artwork editor loading and saving.
-   Unsaved change warning.
-   Conflict UI.
-   Story frame ordering and playback.
-   GIF export state and error handling.
-   Branch switching.
-   Issue and PR interactions.
-   Fork workflow.

## Manual end-to-end checklist

Use a dedicated GitHub test account and test repositories. Do not test
destructive actions on a personal production repository.

1.  Sign in.
2.  Create a public album.
3.  Verify the repository exists on GitHub and `master` is its default
    branch.
4.  Create a private album and verify access restrictions.
5.  Create a 16×16 artwork, save, refresh, and verify every cell.
6.  Repeat with 32×32, 64×64, and 128×128.
7.  Edit an artwork from two sessions and verify stale-write conflict
    detection.
8.  Create a Story with at least three frames.
9.  Reorder frames and set different durations.
10. Preview, pause, resume, and loop the Story.
11. Export a GIF and inspect its frames and timing.
12. Create a branch and save artwork to it.
13. Verify `master` remains unchanged.
14. Compare the branch with `master`.
15. Create, comment on, and close an Issue.
16. Open a PR into `master`.
17. Review and merge the PR in a test repository.
18. Fork an album.
19. Edit artwork in the fork.
20. Open a PR from the fork to upstream.
21. Verify private repository permissions.
22. Revoke app access and verify GridCraft stops making authorized
    requests.
23. Test rate-limit and network-failure UI.
24. Run production build and all automated tests.

------------------------------------------------------------------------

# 10. Environment variables and local setup

Create `.env.example` with placeholders only:

``` env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000

GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

SESSION_SECRET=
TOKEN_ENCRYPTION_KEY=

# Optional only if SQLite-backed sessions/token metadata are selected.
DATABASE_PATH=./data/gridcraft.sqlite
```

Never commit a real `.env` file.

Add scripts that make local development straightforward. For example:

``` bash
npm install
npm run dev
```

The exact scripts can use a root workspace or a concurrently-run
frontend/backend process, whichever best fits the existing repository.

Document GitHub App setup: 1. Create a development GitHub App. 2. Set
local callback URL. 3. Configure only the permissions required for the
current phase. 4. Generate a private key. 5. Add local secrets to
`.env`. 6. Install/authorize the app on a test account. 7. Start
frontend and backend. 8. Test sign-in and the current phase's GitHub
operations.

------------------------------------------------------------------------

# 11. Documentation deliverables

Keep these documents current:

-   `README.md` --- product vision, features, screenshots, setup, and
    links.
-   `PLAN.md` --- this roadmap, updated when decisions change.
-   `CHANGELOG.md` --- version-by-version changes.
-   `docs/ARCHITECTURE.md` --- frontend/backend/GitHub architecture.
-   `docs/GITHUB_APP_SETUP.md` --- GitHub App setup and permissions.
-   `docs/DATA_FORMATS.md` --- album, artwork, and Story schemas.
-   `docs/API.md` --- backend API routes and response contracts.
-   `docs/MIGRATION_V3_TO_V4.md` --- v3.3.0 migration and Snap-to-Story
    migration.
-   `docs/DEPLOYMENT.md` --- deployment, environment variables,
    persistent storage assumptions, and free-tier limitations.

Do not document features as available before they ship.

------------------------------------------------------------------------

# 12. Explicit non-goals for the first release cycle

Do not add these until the roadmap's core workflow is complete:

-   MongoDB or a hosted database for artwork data.
-   Paid image hosting or cloud storage.
-   Paid authentication services.
-   Real-time multiplayer drawing.
-   A custom Git implementation.
-   A custom issue/PR/fork system that duplicates GitHub.
-   A custom source-control database.
-   AI image generation.
-   Marketplace payments.
-   Complex organization/team billing.
-   A full social feed, recommendations engine, or ranking algorithm.
-   Automatic commits for every canvas interaction.
-   Server-side GIF conversion requiring a paid service.

These may be considered later, but they are not necessary to deliver the
GitHub-for-pixel-art product.

------------------------------------------------------------------------

# 13. Definition of done for every release

A release is complete only when:

-   [ ] The version's scope is implemented.
-   [ ] Existing functionality has not regressed.
-   [ ] No secrets are exposed.
-   [ ] Backend validation and authorization are in place.
-   [ ] Loading, empty, success, error, and permission states exist.
-   [ ] Automated tests pass.
-   [ ] Production build passes.
-   [ ] Manual smoke tests are completed.
-   [ ] Documentation is updated.
-   [ ] Changelog is updated.
-   [ ] `package.json` and displayed app version agree.
-   [ ] No unrelated refactor or unrequested feature was bundled into
    the release.
-   [ ] The implementation agent reports any unverified live GitHub
    integration honestly.

------------------------------------------------------------------------

# 14. Final instruction to Antigravity

Treat this file as the product's implementation contract and roadmap.

Start with **v3.4.0 only**. Do not attempt to build v4.0.0 in one pass.

At the beginning of each phase: 1. Read this plan. 2. Inspect the
current repository state. 3. Identify the exact files and modules to
change. 4. Present a concise implementation checklist. 5. Implement only
the current version's scope.

At the end of each phase: 1. Run tests and production build. 2. Perform
the phase's acceptance checks. 3. Update version and changelog. 4.
Update documentation. 5. Summarize completed work, changed files, test
results, and known limitations. 6. Stop and wait for approval before
starting the next version.

**Product north star:** GridCraft is not merely a pixel editor that
happens to connect to GitHub. It is a GitHub-native creative platform
where an album is a repository, an artwork is a versioned file, a Story
is an animation assembled from artworks, and branches, issues, pull
requests, and forks make pixel-art collaboration possible.

------------------------------------------------------------------------

# 15. Official technical references

The implementation agent must consult the current official documentation
before coding each GitHub integration. Endpoint permissions, supported
token types, and API behavior can change.

-   [GitHub Apps vs OAuth
    Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
-   [Authenticating with a GitHub App on behalf of a
    user](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user)
-   [Generating a user access token for a GitHub
    App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
-   [GitHub REST API ---
    Repositories](https://docs.github.com/en/rest/repos/repos)
-   [GitHub REST API --- Repository
    contents](https://docs.github.com/en/rest/repos/contents)
-   [GitHub REST API ---
    Branches](https://docs.github.com/en/rest/branches/branches)
-   [GitHub REST API --- Git
    references](https://docs.github.com/en/rest/git/refs)
-   [GitHub REST API ---
    Issues](https://docs.github.com/en/rest/issues/issues)
-   [GitHub REST API --- Pull
    requests](https://docs.github.com/en/rest/pulls/pulls)
-   [GitHub REST API ---
    Forks](https://docs.github.com/en/rest/repos/forks)
-   [GitHub REST API --- Rate
    limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)

Use these as starting points, not as a substitute for checking the exact
endpoint documentation and permission table at implementation time.
