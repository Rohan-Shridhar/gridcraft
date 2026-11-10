import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config/env.js";

const schema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    github_id INTEGER PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    html_url TEXT,
    default_branch TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(github_id),
    owner_login TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    parent_album_id INTEGER REFERENCES albums(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(owner_id, slug)
  );
  CREATE INDEX IF NOT EXISTS albums_public_order ON albums(updated_at DESC);
  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(github_id),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS issue_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(github_id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS issue_labels (
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    PRIMARY KEY (issue_id, name)
  );
  CREATE TABLE IF NOT EXISTS issue_assignees (
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    login TEXT NOT NULL,
    PRIMARY KEY (issue_id, login)
  );
  CREATE TABLE IF NOT EXISTS pull_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    base_album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    head_album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(github_id),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed', 'merged')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    merged_at TEXT
  );
  CREATE TABLE IF NOT EXISTS pull_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pull_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(github_id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pull_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pull_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(github_id),
    event TEXT NOT NULL CHECK (event IN ('COMMENT', 'APPROVE', 'REQUEST_CHANGES')),
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pull_file_snapshots (
    pull_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    base_sha TEXT,
    head_sha TEXT,
    PRIMARY KEY (pull_id, path)
  );
`;

export class AppStore {
  constructor(databasePath = config.database.path) {
    if (databasePath !== ":memory:") mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(schema);
    const userColumns = this.db.prepare("PRAGMA table_info(users)").all();
    if (!userColumns.some((column) => column.name === "default_branch")) {
      this.db.exec("ALTER TABLE users ADD COLUMN default_branch TEXT");
    }
  }

  close() {
    this.db.close();
  }

  upsertUser(user) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO users (github_id, login, name, avatar_url, html_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(github_id) DO UPDATE SET
        login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url,
        html_url = excluded.html_url, updated_at = excluded.updated_at
    `).run(user.id, user.login, user.name || user.login, user.avatarUrl || null, user.htmlUrl || null, now, now);
    return this.db.prepare("SELECT * FROM users WHERE github_id = ?").get(user.id);
  }

  setUserDefaultBranch(userId, branch) {
    this.db.prepare("UPDATE users SET default_branch = ? WHERE github_id = ?").run(branch, userId);
  }

  listAlbums({ page = 1, perPage = 30 } = {}) {
    const offset = (page - 1) * perPage;
    const albums = this.db.prepare(`
      SELECT a.*, u.avatar_url AS owner_avatar, u.default_branch AS owner_default_branch,
        parent.owner_login AS parent_owner, parent.slug AS parent_slug
      FROM albums a JOIN users u ON u.github_id = a.owner_id
      LEFT JOIN albums parent ON parent.id = a.parent_album_id
      ORDER BY a.updated_at DESC, a.id DESC LIMIT ? OFFSET ?
    `).all(perPage, offset);
    const total = this.db.prepare("SELECT COUNT(*) AS count FROM albums").get().count;
    return {
      albums: albums.map((album) => this.mapAlbum(album)),
      page,
      perPage,
      total,
    };
  }

  listUserAlbums(ownerId) {
    return this.db.prepare(`
      SELECT a.*, u.avatar_url AS owner_avatar, u.default_branch AS owner_default_branch,
        parent.owner_login AS parent_owner, parent.slug AS parent_slug
      FROM albums a JOIN users u ON u.github_id = a.owner_id
      LEFT JOIN albums parent ON parent.id = a.parent_album_id
      WHERE a.owner_id = ? ORDER BY a.updated_at DESC, a.id DESC
    `).all(ownerId).map((album) => this.mapAlbum(album));
  }

  getAlbum(owner, slug) {
    const album = this.db.prepare(`
      SELECT a.*, u.avatar_url AS owner_avatar, u.default_branch AS owner_default_branch,
        parent.owner_login AS parent_owner, parent.slug AS parent_slug
      FROM albums a JOIN users u ON u.github_id = a.owner_id
      LEFT JOIN albums parent ON parent.id = a.parent_album_id
      WHERE lower(a.owner_login) = lower(?) AND lower(a.slug) = lower(?)
    `).get(owner, slug);
    return album ? this.mapAlbum(album) : null;
  }

  getAlbumById(id) {
    const album = this.db.prepare(`
      SELECT a.*, u.avatar_url AS owner_avatar, u.default_branch AS owner_default_branch,
        parent.owner_login AS parent_owner, parent.slug AS parent_slug
      FROM albums a JOIN users u ON u.github_id = a.owner_id
      LEFT JOIN albums parent ON parent.id = a.parent_album_id WHERE a.id = ?
    `).get(id);
    return album ? this.mapAlbum(album) : null;
  }

  createAlbum(user, { slug, name, description = "", parentAlbumId = null }) {
    const owner = this.upsertUser(user);
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO albums (owner_id, owner_login, slug, name, description, parent_album_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(owner.github_id, owner.login, slug, name, description, parentAlbumId, now, now);
    return this.getAlbumById(Number(result.lastInsertRowid));
  }

  upsertAlbum(user, { slug, name, description = "", createdAt, updatedAt, parentAlbumId = null }) {
    const owner = this.upsertUser(user);
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO albums (owner_id, owner_login, slug, name, description, parent_album_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, slug) DO UPDATE SET
        owner_login = excluded.owner_login,
        name = excluded.name,
        description = excluded.description,
        parent_album_id = COALESCE(excluded.parent_album_id, parent_album_id),
        updated_at = excluded.updated_at
    `).run(
      owner.github_id,
      owner.login,
      slug,
      name,
      description,
      parentAlbumId,
      createdAt || now,
      updatedAt || now
    );
    return this.getAlbum(user.login, slug);
  }

  updateAlbum(albumId, { name, description }) {
    this.db.prepare(`
      UPDATE albums SET name = ?, description = ?, updated_at = ? WHERE id = ?
    `).run(name, description, new Date().toISOString(), albumId);
    return this.getAlbumById(albumId);
  }

  deleteAlbum(albumId) {
    this.db.prepare("UPDATE albums SET parent_album_id = NULL WHERE parent_album_id = ?").run(albumId);
    return this.db.prepare("DELETE FROM albums WHERE id = ?").run(albumId).changes > 0;
  }

  mapAlbum(album) {
    return {
      id: album.id,
      ownerId: album.owner_id,
      owner: album.owner_login,
      ownerAvatar: album.owner_avatar || null,
      defaultBranch: album.owner_default_branch || "master",
      slug: album.slug,
      name: album.name,
      description: album.description,
      createdAt: album.created_at,
      updatedAt: album.updated_at,
      parent: album.parent_album_id
        ? { id: album.parent_album_id, owner: album.parent_owner, slug: album.parent_slug }
        : null,
    };
  }

  createIssue(albumId, author, { title, body = "", labels = [], assignees = [] }) {
    const user = this.upsertUser(author);
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO issues (album_id, author_id, title, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(albumId, user.github_id, title, body, now, now);
    const issueId = Number(result.lastInsertRowid);
    const insertLabel = this.db.prepare("INSERT INTO issue_labels (issue_id, name) VALUES (?, ?)");
    for (const label of new Set(labels)) insertLabel.run(issueId, label);
    const insertAssignee = this.db.prepare("INSERT INTO issue_assignees (issue_id, login) VALUES (?, ?)");
    for (const login of new Set(assignees)) insertAssignee.run(issueId, login);
    return this.getIssue(issueId);
  }

  listIssues(albumId, { state = "open", author = "", assignee = "", labels = "", q = "", page = 1, perPage = 20 } = {}) {
    const clauses = ["i.album_id = ?"];
    const values = [albumId];
    if (state !== "all") {
      clauses.push("i.state = ?");
      values.push(state);
    }
    if (author) {
      clauses.push("lower(u.login) = lower(?)");
      values.push(author);
    }
    if (assignee) {
      clauses.push("EXISTS (SELECT 1 FROM issue_assignees ia WHERE ia.issue_id = i.id AND lower(ia.login) = lower(?))");
      values.push(assignee);
    }
    const labelNames = labels.split(",").map((label) => label.trim().toLowerCase()).filter(Boolean);
    for (const label of labelNames) {
      clauses.push("EXISTS (SELECT 1 FROM issue_labels il WHERE il.issue_id = i.id AND lower(il.name) = ?)");
      values.push(label);
    }
    if (q) {
      clauses.push("(i.title LIKE ? OR i.body LIKE ?)");
      values.push(`%${q}%`, `%${q}%`);
    }
    const where = clauses.join(" AND ");
    const rows = this.db.prepare(`
      SELECT i.*, u.login AS author_login, u.avatar_url AS author_avatar,
        (SELECT COUNT(*) FROM issue_comments c WHERE c.issue_id = i.id) AS comments
      FROM issues i JOIN users u ON u.github_id = i.author_id
      WHERE ${where} ORDER BY i.updated_at DESC LIMIT ? OFFSET ?
    `).all(...values, perPage, (page - 1) * perPage);
    const total = this.db.prepare(`SELECT COUNT(*) AS count FROM issues i JOIN users u ON u.github_id = i.author_id WHERE ${where}`).get(...values).count;
    return {
      issues: rows.map((row) => this.mapIssue(row)),
      page,
      perPage,
      hasNext: page * perPage < total,
      total,
    };
  }

  getIssue(issueId, { page = 1, perPage = 20 } = {}) {
    const row = this.db.prepare(`
      SELECT i.*, u.login AS author_login, u.avatar_url AS author_avatar,
        (SELECT COUNT(*) FROM issue_comments c WHERE c.issue_id = i.id) AS comments
      FROM issues i JOIN users u ON u.github_id = i.author_id WHERE i.id = ?
    `).get(issueId);
    if (!row) return null;
    const comments = this.db.prepare(`
      SELECT c.id, c.body, c.created_at, u.login, u.avatar_url
      FROM issue_comments c JOIN users u ON u.github_id = c.author_id
      WHERE c.issue_id = ? ORDER BY c.id LIMIT ? OFFSET ?
    `).all(issueId, perPage, (page - 1) * perPage).map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.created_at,
      user: { login: comment.login, avatarUrl: comment.avatar_url },
    }));
    return {
      issue: this.mapIssue(row),
      comments,
      commentsPage: page,
      commentsHasNext: page * perPage < row.comments,
    };
  }

  getIssueAlbum(issueId) {
    return this.db.prepare(`
      SELECT a.id, a.owner_login
      FROM issues i JOIN albums a ON a.id = i.album_id
      WHERE i.id = ?
    `).get(issueId);
  }

  mapIssue(row) {
    const labels = this.db.prepare("SELECT name FROM issue_labels WHERE issue_id = ? ORDER BY name")
      .all(row.id).map((label) => ({ name: label.name, color: "888888" }));
    const assignees = this.db.prepare("SELECT login FROM issue_assignees WHERE issue_id = ? ORDER BY login")
      .all(row.id).map((assignee) => ({ login: assignee.login }));
    return {
      number: row.id,
      title: row.title,
      body: row.body,
      state: row.state,
      user: { login: row.author_login, avatarUrl: row.author_avatar },
      comments: row.comments,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
      htmlUrl: null,
      labels,
      assignees,
      isPullRequest: false,
    };
  }

  updateIssue(issueId, changes) {
    const current = this.getIssue(issueId)?.issue;
    if (!current) return null;
    const state = changes.state || current.state;
    this.db.prepare(`
      UPDATE issues SET title = ?, body = ?, state = ?, updated_at = ?, closed_at = ?
      WHERE id = ?
    `).run(
      changes.title || current.title,
      changes.body === undefined ? current.body : changes.body,
      state,
      new Date().toISOString(),
      state === "closed" ? current.closedAt || new Date().toISOString() : null,
      issueId
    );
    return this.getIssue(issueId).issue;
  }

  addIssueComment(issueId, author, body) {
    const user = this.upsertUser(author);
    const now = new Date().toISOString();
    const result = this.db.prepare("INSERT INTO issue_comments (issue_id, author_id, body, created_at) VALUES (?, ?, ?, ?)")
      .run(issueId, user.github_id, body, now);
    this.db.prepare("UPDATE issues SET updated_at = ? WHERE id = ?").run(now, issueId);
    return {
      id: Number(result.lastInsertRowid),
      body,
      createdAt: now,
      user: { login: user.login, avatarUrl: user.avatar_url },
    };
  }

  listPulls(albumId, { state = "open", page = 1, perPage = 20 } = {}) {
    const stateClause = state === "all"
      ? ""
      : state === "closed"
        ? "AND p.state IN ('closed', 'merged')"
        : "AND p.state = ?";
    const values = state === "all" || state === "closed"
      ? [albumId, albumId]
      : [albumId, albumId, state];
    const rows = this.db.prepare(`
      SELECT p.*, base.owner_login AS base_owner, base.slug AS base_slug,
        head.owner_login AS head_owner, head.slug AS head_slug,
        u.login AS author_login, u.avatar_url AS author_avatar,
        (SELECT COUNT(*) FROM pull_comments c WHERE c.pull_id = p.id) AS comments,
        (SELECT COUNT(*) FROM pull_reviews r WHERE r.pull_id = p.id) AS review_count,
        (SELECT COUNT(*) FROM pull_file_snapshots f WHERE f.pull_id = p.id) AS changed_files
      FROM pull_requests p
      JOIN albums base ON base.id = p.base_album_id
      JOIN albums head ON head.id = p.head_album_id
      JOIN users u ON u.github_id = p.author_id
      WHERE (p.base_album_id = ? OR p.head_album_id = ?) ${stateClause}
      ORDER BY p.updated_at DESC LIMIT ? OFFSET ?
    `).all(...values, perPage, (page - 1) * perPage);
    const total = this.db.prepare(`
      SELECT COUNT(*) AS count FROM pull_requests p
      WHERE (p.base_album_id = ? OR p.head_album_id = ?) ${stateClause}
    `).get(...values).count;
    return { pulls: rows.map((row) => this.mapPull(row)), page, perPage, hasNext: page * perPage < total };
  }

  createPull({ baseAlbumId, headAlbumId, author, title, body = "", files = [] }) {
    const user = this.upsertUser(author);
    const now = new Date().toISOString();
    this.db.exec("BEGIN");
    try {
    const result = this.db.prepare(`
      INSERT INTO pull_requests (base_album_id, head_album_id, author_id, title, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(baseAlbumId, headAlbumId, user.github_id, title, body, now, now);
      const pullId = Number(result.lastInsertRowid);
      const insertFile = this.db.prepare(
        "INSERT INTO pull_file_snapshots (pull_id, path, base_sha, head_sha) VALUES (?, ?, ?, ?)"
      );
      for (const file of files) insertFile.run(pullId, file.path, file.baseSha, file.headSha);
      this.db.exec("COMMIT");
      return this.getPull(pullId);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getPull(pullId) {
    const row = this.db.prepare(`
      SELECT p.*, base.owner_login AS base_owner, base.slug AS base_slug,
        head.owner_login AS head_owner, head.slug AS head_slug,
        u.login AS author_login, u.avatar_url AS author_avatar,
        (SELECT COUNT(*) FROM pull_comments c WHERE c.pull_id = p.id) AS comments,
        (SELECT COUNT(*) FROM pull_reviews r WHERE r.pull_id = p.id) AS review_count
      FROM pull_requests p
      JOIN albums base ON base.id = p.base_album_id
      JOIN albums head ON head.id = p.head_album_id
      JOIN users u ON u.github_id = p.author_id WHERE p.id = ?
    `).get(pullId);
    if (!row) return null;
    const comments = this.db.prepare(`
      SELECT c.id, c.body, c.created_at, u.login, u.avatar_url
      FROM pull_comments c JOIN users u ON u.github_id = c.author_id
      WHERE c.pull_id = ? ORDER BY c.id
    `).all(pullId).map((comment) => ({
      id: comment.id, body: comment.body, createdAt: comment.created_at,
      user: { login: comment.login, avatarUrl: comment.avatar_url },
    }));
    const reviews = this.db.prepare(`
      SELECT r.id, r.event, r.body, r.created_at, u.login, u.avatar_url
      FROM pull_reviews r JOIN users u ON u.github_id = r.author_id
      WHERE r.pull_id = ? ORDER BY r.id
    `).all(pullId).map((review) => ({
      id: review.id, state: review.event, body: review.body, submittedAt: review.created_at,
      user: { login: review.login, avatarUrl: review.avatar_url },
    }));
    const files = this.db.prepare(
      "SELECT path, base_sha, head_sha FROM pull_file_snapshots WHERE pull_id = ? ORDER BY path"
    ).all(pullId).map((file) => ({
      filename: file.path,
      status: file.head_sha === null ? "removed" : file.base_sha === null ? "added" : "modified",
      baseSha: file.base_sha,
      headSha: file.head_sha,
      additions: 0,
      deletions: 0,
    }));
    return {
      pull: this.mapPull({ ...row, changed_files: files.length }),
      comments,
      reviews,
      files,
      commits: [],
      commentsHasNext: false,
      permissions: { push: true },
      mergeMethods: { merge: true, squash: false, rebase: false },
    };
  }

  getPullContext(pullId) {
    return this.db.prepare(`
      SELECT p.*, base.owner_login AS base_owner, base.slug AS base_slug,
        head.owner_login AS head_owner, head.slug AS head_slug
      FROM pull_requests p
      JOIN albums base ON base.id = p.base_album_id
      JOIN albums head ON head.id = p.head_album_id
      WHERE p.id = ?
    `).get(pullId);
  }

  mapPull(row) {
    return {
      number: row.id,
      title: row.title,
      body: row.body,
      state: row.state === "merged" ? "closed" : row.state,
      merged: row.state === "merged",
      mergeable: row.state === "open",
      mergeableState: row.state === "open" ? "clean" : row.state,
      htmlUrl: null,
      user: { login: row.author_login, avatarUrl: row.author_avatar },
      base: { ref: row.base_slug, repo: `${row.base_owner}/${row.base_slug}` },
      head: { ref: row.head_slug, repo: `${row.head_owner}/${row.head_slug}` },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      mergedAt: row.merged_at,
      comments: row.comments,
      commits: 0,
      changedFiles: row.changed_files || 0,
      additions: 0,
      deletions: 0,
    };
  }

  addPullComment(pullId, author, body) {
    const user = this.upsertUser(author);
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO pull_comments (pull_id, author_id, body, created_at) VALUES (?, ?, ?, ?)")
      .run(pullId, user.github_id, body, now);
    this.db.prepare("UPDATE pull_requests SET updated_at = ? WHERE id = ?").run(now, pullId);
    return this.getPull(pullId).comments.at(-1);
  }

  addPullReview(pullId, author, event, body) {
    const user = this.upsertUser(author);
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO pull_reviews (pull_id, author_id, event, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(pullId, user.github_id, event, body, now);
    this.db.prepare("UPDATE pull_requests SET updated_at = ? WHERE id = ?").run(now, pullId);
    return this.getPull(pullId).reviews.at(-1);
  }

  setPullState(pullId, state) {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE pull_requests SET state = ?, updated_at = ?, merged_at = ? WHERE id = ?")
      .run(state, now, state === "merged" ? now : null, pullId);
    return this.getPull(pullId);
  }

  updatePull(pullId, changes) {
    const current = this.getPull(pullId)?.pull;
    if (!current) return null;
    this.db.prepare(`
      UPDATE pull_requests
      SET title = ?, body = ?, state = ?, updated_at = ?, merged_at = ?
      WHERE id = ?
    `).run(
      changes.title ?? current.title,
      changes.body ?? current.body,
      changes.state ?? (current.merged ? "merged" : current.state),
      new Date().toISOString(),
      changes.state === "merged" || current.merged ? new Date().toISOString() : null,
      pullId
    );
    return this.getPull(pullId);
  }
}

export const appStore = new AppStore();
