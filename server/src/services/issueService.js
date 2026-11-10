import { z } from "zod";
import { albumService } from "./albumService.js";

const CreateIssueSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional().default(""),
  labels: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
  assignees: z.array(z.string().trim().min(1).max(39)).max(20).optional().default([]),
});

const UpdateIssueSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  body: z.string().max(65536).optional(),
  state: z.enum(["open", "closed"]).optional(),
});

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
    return this.store.listIssues(album.id, {
      state: query.state || "open",
      page: Math.max(1, Number(query.page) || 1),
      perPage: Math.min(100, Math.max(1, Number(query.perPage) || 20)),
      author: query.author || "",
      assignee: query.assignee || "",
      labels: query.labels || "",
      q: query.q || "",
    });
  }

  getIssue(_accessToken, owner, repoName, number, commentsPage = 1) {
    this.#album(owner, repoName);
    const result = this.store.getIssue(Number(number), {
      page: Math.max(1, Number(commentsPage) || 1),
      perPage: 20,
    });
    if (!result) {
      const error = new Error("Issue was not found.");
      error.status = 404;
      throw error;
    }
    const context = this.store.getIssueAlbum(Number(number));
    if (context?.id !== this.store.getAlbum(owner, repoName)?.id) {
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
    return { issue: this.store.updateIssue(Number(number), validated) };
  }

  addComment(_accessToken, owner, repoName, user, number, body) {
    this.#requireSignedIn(user);
    this.getIssue(null, owner, repoName, number);
    const text = z.string().min(1).max(65536).parse(body);
    return { comment: this.store.addIssueComment(Number(number), user, text) };
  }
}

export const issueService = new IssueService();
