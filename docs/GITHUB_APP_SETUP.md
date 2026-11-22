# GitHub App Setup: `gridcraft-auth`

GridCraft uses a dedicated GitHub App named `gridcraft-auth` to provide secure, fine-grained access to GitHub resources on behalf of authenticated creators.

---

## 1. GitHub App Configuration

1. In GitHub, go to **Settings** > **Developer Settings** > **GitHub Apps** > **New GitHub App**.
2. **App Name**: `gridcraft-auth`
3. **Homepage URL**: `http://localhost:5173` (or your production domain).
4. **Callback URL**: `http://localhost:4000/api/v1/auth/github/callback` for local development and `https://gridcraft-by-me.vercel.app/api/v1/auth/github/callback` for production. The callback must exactly match the `redirect_uri` generated from `BACKEND_URL`.
5. **Request user authorization (OAuth) during installation**: Checked.

Before using GridCraft, each creator must create a **public** repository named
`gridcraft-artworks` on their GitHub account and initialize it with a README.
They must then install `gridcraft-auth` on that repository and grant the
permissions below. GridCraft uses this repository for album, Story, and artwork
files; repository creation is not a substitute for installing the App.

---

## 2. Permissions Required

For the current release (**v4.0.0**):
- **Repository permissions**:
  - `Contents`: Read & Write (to manage the catalog, album, Story, and artwork files)
  - `Metadata`: Read-only (required for all apps)

Basic account identity is read from the OAuth `/user` endpoint; GridCraft does
not request or use email addresses.

GridCraft issues, pull requests, comments, and reviews are stored by GridCraft,
so GitHub Issues and Pull Requests permissions are not required. Albums are
folders in the single public artwork repository, not separate GitHub
repositories.

The backend exposes a setup link for installing the App. Set `GITHUB_APP_SLUG`
to the GitHub App’s URL slug (default: `gridcraft-auth`).

### User authorization token expiration

The **Expire user authorization tokens** setting affects the access tokens
GridCraft stores. The current backend does not refresh expiring tokens; if this
setting is enabled, users may need to authorize again when the token expires.
Choose the setting deliberately and plan for reauthorization until token
refresh support is implemented.

---

## 3. Environment Variables Configuration

In your local `.env` file (never commit this file):

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000

GITHUB_APP_ID=your_app_id
GITHUB_APP_SLUG=gridcraft-auth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

SESSION_SECRET=use_a_random_32_byte_secret_here
TOKEN_ENCRYPTION_KEY=use_a_random_32_byte_secret_here
```

---

## 4. Local Testing

1. Start both client and server:
   ```bash
   npm run dev
   ```
2. Create a public `gridcraft-artworks` repository with a README and install
   `gridcraft-auth` on it with Contents read/write permission.
3. Open `http://localhost:5173` and click **Continue with GitHub**.
4. Authorize `gridcraft-auth` on GitHub.
5. You will be redirected back with a signed-in session and access to the Creator Dashboard.
