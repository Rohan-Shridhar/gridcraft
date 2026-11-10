import { z } from "zod";
import { githubRequest } from "../utils/githubClient.js";
import { albumService } from "./albumService.js";
import { ARTWORKS_REPOSITORY } from "./albumService.js";

const CreatePullSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional().default(""),
  head: z.string().min(1).max(255).optional(),
  headOwner: z.string().max(39).optional(),
  headAlbum: z.string().max(100).optional(),
});

const ReviewSchema = z.object({
  body: z.string().max(65536).optional().default(""),
  event: z.enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"]),
});

function encodedPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function albumFiles(tree, slug) {
  const prefix = `${slug}/`;
  return new Map(
    (tree.tree || [])
      .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix)
        && entry.path !== `${prefix}album.json`)
      .map((entry) => [entry.path.slice(prefix.length), entry.sha])
  );
}

export class PullRequestService {
  constructor(fetchFn = globalThis.fetch, store = albumService.store) {
    this.fetch = fetchFn;
    this.store = store;
  }

  async #request(endpoint, accessToken, options = {}) {
    return githubRequest(this.fetch, endpoint, accessToken, options);
  }

  async #getAlbumFiles(accessToken, owner, slug) {
    const { data: repository } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}`,
      accessToken
    );
    const branch = repository.default_branch || "master";
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      accessToken
    );
    if (data.truncated) {
      const error = new Error("The artwork library is too large to safely compare.");
      error.status = 422;
      throw error;
    }
    return { files: albumFiles(data, slug), branch };
  }

  async #getBlobContent(accessToken, owner, sha) {
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/git/blobs/${encodeURIComponent(sha)}`,
      accessToken
    );
    if (data.encoding !== "base64" || typeof data.content !== "string") {
      const error = new Error("The proposed file could not be read from GitHub.");
      error.status = 422;
      throw error;
    }
    return data.content.replace(/\s/g, "");
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

  #pullForAlbum(owner, slug, number) {
    const album = this.#album(owner, slug);
    const result = this.store.getPull(Number(number));
    const context = this.store.getPullContext(Number(number));
    if (!result || !context
      || (context.base_album_id !== album.id && context.head_album_id !== album.id)) {
      const error = new Error("Pull request was not found in this album.");
      error.status = 404;
      throw error;
    }
    return { album, result, context };
  }

  listPulls(_accessToken, owner, repoName, query = {}) {
    const album = this.#album(owner, repoName);
    return this.store.listPulls(album.id, {
      state: query.state || "open",
      page: query.page || 1,
      perPage: query.perPage || 20,
    });
  }

  getPull(_accessToken, owner, repoName, user, number) {
    const { result, context } = this.#pullForAlbum(owner, repoName, number);
    return {
      ...result,
      permissions: { push: context.base_owner.toLowerCase() === user?.login?.toLowerCase() },
    };
  }

  async createPull(accessToken, owner, repoName, user, input) {
    this.#requireSignedIn(user);
    const baseAlbum = this.#album(owner, repoName);
    const validated = CreatePullSchema.parse(input);
    let headOwner = validated.headOwner;
    let headAlbum = validated.headAlbum;
    if ((!headOwner || !headAlbum) && validated.head) {
      const match = validated.head.match(/^([^/]+)\/([^/]+)$/);
      if (match) [, headOwner, headAlbum] = match;
    }
    if (!headOwner || !headAlbum) {
      const error = new Error("Select a source album for this pull request.");
      error.status = 400;
      throw error;
    }
    const sourceAlbum = this.#album(headOwner, headAlbum);
    if (sourceAlbum.id === baseAlbum.id) {
      const error = new Error("A pull request must come from a different album.");
      error.status = 400;
      throw error;
    }
    if (sourceAlbum.owner.toLowerCase() !== user.login.toLowerCase()) {
      const error = new Error("You can only submit a pull request from an album you own.");
      error.status = 403;
      throw error;
    }
    const [baseSnapshot, headSnapshot] = await Promise.all([
      this.#getAlbumFiles(accessToken, baseAlbum.owner, baseAlbum.slug),
      this.#getAlbumFiles(accessToken, sourceAlbum.owner, sourceAlbum.slug),
    ]);
    const baseFiles = baseSnapshot.files;
    const headFiles = headSnapshot.files;
    const files = [...new Set([...baseFiles.keys(), ...headFiles.keys()])]
      .filter((path) => baseFiles.get(path) !== headFiles.get(path))
      .map((path) => ({
        path,
        baseSha: baseFiles.get(path) || null,
        headSha: headFiles.get(path) || null,
      }));
    if (!files.length) {
      const error = new Error("The selected albums have no story or artwork changes to propose.");
      error.status = 409;
      error.code = "NO_CHANGES";
      throw error;
    }
    return {
      pull: this.store.createPull({
        baseAlbumId: baseAlbum.id,
        headAlbumId: sourceAlbum.id,
        author: user,
        title: validated.title,
        body: validated.body,
        files,
      }).pull,
    };
  }

  updatePull(_accessToken, owner, repoName, user, number, input) {
    this.#requireSignedIn(user);
    const { result, context } = this.#pullForAlbum(owner, repoName, number);
    if (![result.pull.user.login, context.base_owner].some((login) => login.toLowerCase() === user.login.toLowerCase())) {
      const error = new Error("Only the pull request author or base album owner can update it.");
      error.status = 403;
      throw error;
    }
    const changes = z.object({
      title: z.string().min(1).max(256).optional(),
      body: z.string().max(65536).optional(),
      state: z.enum(["open", "closed"]).optional(),
    }).parse(input);
    if (!Object.keys(changes).length) {
      const error = new Error("No supported pull request changes were provided.");
      error.status = 400;
      throw error;
    }
    return { pull: this.store.updatePull(Number(number), changes).pull };
  }

  submitReview(_accessToken, owner, repoName, user, number, input) {
    this.#requireSignedIn(user);
    this.#pullForAlbum(owner, repoName, number);
    const review = ReviewSchema.parse(input);
    return { review: this.store.addPullReview(Number(number), user, review.event, review.body) };
  }

  commentOnPull(_accessToken, owner, repoName, user, number, body) {
    this.#requireSignedIn(user);
    this.#pullForAlbum(owner, repoName, number);
    const text = z.string().min(1).max(65536).parse(body);
    return { comment: this.store.addPullComment(Number(number), user, text) };
  }

  async mergePull(accessToken, owner, repoName, user, number) {
    this.#requireSignedIn(user);
    const { context } = this.#pullForAlbum(owner, repoName, number);
    if (context.base_owner.toLowerCase() !== user.login.toLowerCase()) {
      const error = new Error("Only the base album owner can merge this pull request.");
      error.status = 403;
      throw error;
    }
    if (context.state !== "open") {
      const error = new Error("Only open pull requests can be merged.");
      error.status = 409;
      error.code = "NOT_MERGEABLE";
      throw error;
    }

    const snapshot = this.store.getPull(Number(number)).files;
    const [baseSnapshot, headSnapshot] = await Promise.all([
      this.#getAlbumFiles(accessToken, context.base_owner, context.base_slug),
      this.#getAlbumFiles(accessToken, context.head_owner, context.head_slug),
    ]);
    const baseFiles = baseSnapshot.files;
    const headFiles = headSnapshot.files;
    for (const file of snapshot) {
      const sourceExpected = file.status === "removed" ? null : file.headSha;
      const destinationExpected = file.status === "added" ? null : file.baseSha;
      if ((headFiles.get(file.filename) || null) !== sourceExpected
        || (baseFiles.get(file.filename) || null) !== destinationExpected) {
        const error = new Error(`The proposed file "${file.filename}" changed after this request was opened.`);
        error.status = 409;
        error.code = "CONFLICT";
        throw error;
      }
    }

    const { data: branchCommit } = await this.#request(
      `/repos/${encodeURIComponent(context.base_owner)}/${ARTWORKS_REPOSITORY}/commits/${encodeURIComponent(baseSnapshot.branch)}`,
      accessToken
    );
    const treeEntries = [];
    for (const file of snapshot) {
      const destinationPath = `${context.base_slug}/${file.filename}`;
      if (file.status === "removed") {
        treeEntries.push({ path: destinationPath, mode: "100644", type: "blob", sha: null });
        continue;
      }
      const content = await this.#getBlobContent(accessToken, context.head_owner, file.headSha);
      const { data: blob } = await this.#request(
        `/repos/${encodeURIComponent(context.base_owner)}/${ARTWORKS_REPOSITORY}/git/blobs`,
        accessToken,
        { method: "POST", body: JSON.stringify({ content, encoding: "base64" }) }
      );
      treeEntries.push({ path: destinationPath, mode: "100644", type: "blob", sha: blob.sha });
    }
    const { data: mergedTree } = await this.#request(
      `/repos/${encodeURIComponent(context.base_owner)}/${ARTWORKS_REPOSITORY}/git/trees`,
      accessToken,
      { method: "POST", body: JSON.stringify({ base_tree: branchCommit.commit.tree.sha, tree: treeEntries }) }
    );
    const { data: commit } = await this.#request(
      `/repos/${encodeURIComponent(context.base_owner)}/${ARTWORKS_REPOSITORY}/git/commits`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          message: `merge(pull): ${context.title}`,
          tree: mergedTree.sha,
          parents: [branchCommit.sha],
        }),
      }
    );
    await this.#request(
      `/repos/${encodeURIComponent(context.base_owner)}/${ARTWORKS_REPOSITORY}/git/refs/heads/${encodeURIComponent(baseSnapshot.branch)}`,
      accessToken,
      { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }), retry: false }
    );

    const result = this.store.updatePull(Number(number), { state: "merged" });
    return { merged: true, pull: result.pull };
  }
}

export const pullRequestService = new PullRequestService();
