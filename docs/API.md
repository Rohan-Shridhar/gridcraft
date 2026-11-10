# GridCraft Backend API Documentation (v3.4.0)

Base URL: `/api/v1`

---

## Health Check

### `GET /api/v1/health`
Returns the operational health and version of the backend service.

**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "3.4.0",
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

**Behavior:**
- Generates a 32-byte cryptographically secure random `state`.
- Sets an HttpOnly, SameSite `gc_oauth_state` cookie.
- Redirects user to `https://github.com/login/oauth/authorize`.

---

### `GET /api/v1/auth/github/callback`
Handles the redirect callback from GitHub after user authorization.

**Query Parameters:**
- `code`: The temporary GitHub authorization code.
- `state`: The unguessable state string for CSRF validation.
- `error` / `error_description`: Present if user denied authorization.

**Behavior:**
- Validates that `state` matches the value stored in the `gc_oauth_state` cookie.
- Exchanges `code` for a GitHub user access token.
- Fetches the user's profile from `https://api.github.com/user`.
- Encrypts the access token using AES-256-GCM.
- Establishes a signed session in the `gc_session` HttpOnly cookie.
- Clears the temporary state cookie.
- Redirects to `${FRONTEND_URL}/?auth_success=1` (or returns JSON if `Accept: application/json`).

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

**Response (Unauthenticated - 200 OK):**
```json
{
  "authenticated": false,
  "user": null
}
```

---

### `POST /api/v1/auth/logout`
Signs out the user by clearing the session cookie.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### `POST /api/v1/auth/disconnect`
Requires authentication (`requireAuth`). Revokes the GitHub user access token with GitHub and clears the session cookie.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Disconnected successfully"
}
```

---

## Standard Error Response Format

When an API request fails, the response follows a standardized JSON structure:

```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "Invalid or expired OAuth state. Please try signing in again."
  }
}
```
