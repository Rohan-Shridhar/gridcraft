# GitHub App Setup: `gridcraft-auth`

GridCraft uses a dedicated GitHub App named `gridcraft-auth` to provide secure, fine-grained access to GitHub resources on behalf of authenticated creators.

---

## 1. GitHub App Configuration

1. In GitHub, go to **Settings** > **Developer Settings** > **GitHub Apps** > **New GitHub App**.
2. **App Name**: `gridcraft-auth`
3. **Homepage URL**: `http://localhost:5173` (or your production domain).
4. **Callback URL**: `http://localhost:4000/api/v1/auth/github/callback` (or your production API URL).
5. **Request user authorization (OAuth) during installation**: Checked.

---

## 2. Permissions Required

For **v3.4.0 (Authentication)**:
- **Account permissions**:
  - `Email addresses`: Read-only (optional)
  - `User Profile`: Basic identity is accessible via OAuth `/user`.

For the current release (**v3.11.0**):
- **Repository permissions**:
  - `Contents`: Read & Write (for artwork JSON files, story manifests, and commits)
  - `Metadata`: Read-only (required for all apps)
  - `Pull requests`: Read & Write (for reviewing and opening PRs)
  - `Issues`: Read & Write (for commenting, creating, and managing issues)
  - `Administration`: Read & Write (for repository creation/default branch initialization)
  - Forking is controlled by GitHub account and organization policies; there is no separate GitHub App permission for it.

---

## 3. Environment Variables Configuration

In your local `.env` file (never commit this file):

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000

GITHUB_APP_ID=your_app_id
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
2. Open `http://localhost:5173`.
3. Click **Continue with GitHub**.
4. Authorize `gridcraft-auth` on GitHub.
5. You will be redirected back with a signed-in session and access to the Creator Dashboard.
