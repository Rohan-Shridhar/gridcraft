import { z } from "zod";
import { albumService } from "./albumService.js";

const CreateIssueSchema = z.object({
  title: z.string().trim().min(1).max(256),
  body: z.string().max(65536).optional().default(""),
  labels: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
  assignees: z.array(z.string().trim().min(1).max(39)).max(20).optional().default([]),
});

const UpdateIssueSchema = z.object({
  title: z.string().trim().min(1).max(256).optional(),
  body: z.string().max(65536).optional(),
  state: z.enum(["open", "closed"]).optional(),
});

function parsePositiveInt(value, fallback, max = Number.POSITIVE_INFINITY) {
  let parsed;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    parsed = Number(value.trim());
  } else {
    return fallback;
  }
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(max, parsed);
}

function parseIssueNumber(value) {
  const parsed = parsePositiveInt(value, null);
  if (parsed === null) {
    const error = new Error("Issue number must be a positive integer.");
    error.status = 400;
    throw error;
  }
  return parsed;
}

export class IssueService {
  constructor(store = albumService.store) {
    this.store = store;
  }

  #album(owner, slug) {
    const album = this.store.getAlbum(owner, slug);
    if (!album) {
      const error = new Error("Album was not found in GridCraft.");
      error.status = 404;
      throw error;
    }
    return album;
  }

  #requireSignedIn(user) {
    if (!user?.id || !user.login) {
      const error = new Error("A signed-in GridCraft user is required.");
      error.status = 401;
      throw error;
    }
  }

  #canManage(user, issue, album) {
    return user.login.toLowerCase() === album.owner.toLowerCase()
      || user.login.toLowerCase() === issue.user.login.toLowerCase();
  }

  listIssues(_accessToken, owner, repoName, query = {}) {
    const album = this.#album(owner, repoName);
    const filters = query && typeof query === "object" ? query : {};
    const state = ["open", "closed", "all"].includes(filters.state) ? filters.state : "open";
    return this.store.listIssues(album.id, {
      state,
      page: parsePositiveInt(filters.page, 1),
      perPage: parsePositiveInt(filters.perPage, 20, 100),
      author: typeof filters.author === "string" ? filters.author : "",
      assignee: typeof filters.assignee === "string" ? filters.assignee : "",
      labels: typeof filters.labels === "string" ? filters.labels : "",
      q: typeof filters.q === "string" ? filters.q : "",
    });
  }

  getIssue(_accessToken, owner, repoName, number, commentsPage = 1) {
    const album = this.#album(owner, repoName);
    const issueNumber = parseIssueNumber(number);
    const result = this.store.getIssue(issueNumber, {
      page: parsePositiveInt(commentsPage, 1),
      perPage: 20,
    });
    if (!result) {
      const error = new Error("Issue was not found.");
      error.status = 404;
      throw error;
    }
    const context = this.store.getIssueAlbum(issueNumber);
    if (context?.id !== album.id) {
      const error = new Error("Issue was not found in this album.");
      error.status = 404;
      throw error;
    }
    return {
      issue: result.issue,
      commentsPage: result.commentsPage,
      commentsHasNext: result.commentsHasNext,
      comments: result.comments,
    };
  }

  createIssue(_accessToken, owner, repoName, user, input) {
    this.#requireSignedIn(user);
    const album = this.#album(owner, repoName);
    const validated = CreateIssueSchema.parse(input);
    return { issue: this.store.createIssue(album.id, user, validated).issue };
  }

  updateIssue(_accessToken, owner, repoName, user, number, input) {
    this.#requireSignedIn(user);
    const album = this.#album(owner, repoName);
    const { issue } = this.getIssue(null, owner, repoName, number);
    if (!this.#canManage(user, issue, album)) {
      const error = new Error("Only the issue author or album owner can update this issue.");
      error.status = 403;
      throw error;
    }
    const validated = UpdateIssueSchema.parse(input);
    if (!Object.values(validated).some((value) => value !== undefined)) {
      const error = new Error("No supported issue changes were provided.");
      error.status = 400;
      throw error;
    }
    return { issue: this.store.updateIssue(issue.number, validated) };
  }

  addComment(_accessToken, owner, repoName, user, number, body) {
    this.#requireSignedIn(user);
    const { issue } = this.getIssue(null, owner, repoName, number);
    const text = z.string().trim().min(1).max(65536).parse(body);
    return { comment: this.store.addIssueComment(issue.number, user, text) };
  }
}

export const issueService = new IssueService();
