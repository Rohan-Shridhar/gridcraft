import { CreateStoryInputSchema, StorySchema, sanitizeStoryId } from "../validators/storyValidator.js";
import { githubRequest } from "../utils/githubClient.js";
import { albumService, ARTWORKS_REPOSITORY } from "./albumService.js";

function githubPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

export class StoryService {
  constructor(fetchFn = globalThis.fetch, store = albumService.store) {
    this.fetch = fetchFn;
    this.store = store;
  }

  async #request(endpoint, accessToken, options = {}) {
    const { data } = await githubRequest(this.fetch, endpoint, accessToken, options);
    return data;
  }

  #albumPath(albumId, storyId) {
    const cleanAlbumId = sanitizeStoryId(albumId);
    const cleanStoryId = sanitizeStoryId(storyId);
    if (!cleanAlbumId || !cleanStoryId) {
      const err = new Error("Invalid album or story id");
      err.status = 400;
      throw err;
    }
    return `${cleanAlbumId}/${cleanStoryId}`;
  }

  #path(albumId, storyId) {
    return `${this.#albumPath(albumId, storyId)}/story.json`;
  }

  #requireAlbum(owner, albumId) {
    if (!sanitizeStoryId(albumId)) {
      const err = new Error("Invalid album id");
      err.status = 400;
      throw err;
    }
    const album = this.store.getAlbum(owner, albumId);
    if (!album || album.slug !== albumId) {
      const err = new Error("Album was not found in GridCraft.");
      err.status = 404;
      throw err;
    }
  }

  #requireOwner(user, owner, albumId) {
    if (user?.login?.toLowerCase() !== owner.toLowerCase()) {
      const err = new Error("Only the album owner can edit stories.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    this.#requireAlbum(owner, albumId);
  }

  async listStories(accessToken, owner, repoName, branch = "master") {
    this.#requireAlbum(owner, repoName);
    let entries;
    try {
      entries = await this.#request(
        `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(repoName)}?ref=${encodeURIComponent(branch)}`,
        accessToken
      );
    } catch (err) {
      if (err.status === 404) return [];
      throw err;
    }

    if (!Array.isArray(entries)) return [];
    const folders = entries.filter((item) => item.type === "dir");

    return Promise.all(
      folders.map(async (folder) => {
        const detail = await this.getStory(accessToken, owner, repoName, folder.name, branch);
        return { ...detail.story, sha: detail.sha };
      })
    );
  }

  async #validateFrameArtworks(accessToken, owner, albumId, storyId, frames, branch) {
    await Promise.all(
      frames.map(async (frame) => {
        const result = await this.#request(
          `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(`${this.#albumPath(albumId, storyId)}/${frame.artworkPath}`)}?ref=${encodeURIComponent(branch)}`,
          accessToken
        );
        if (!result?.content) {
          const err = new Error(`Referenced artwork "${frame.artworkId}" has no readable content.`);
          err.status = 422;
          err.code = "VALIDATION_ERROR";
          throw err;
        }
      })
    );
  }

  async getStory(accessToken, owner, repoName, storyId, branch = "master") {
    this.#requireAlbum(owner, repoName);
    const cleanId = sanitizeStoryId(storyId);
    const file = await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(this.#path(repoName, cleanId))}?ref=${encodeURIComponent(branch)}`,
      accessToken
    );
    const raw = Buffer.from(file.content, "base64").toString("utf8");
    const story = StorySchema.parse(JSON.parse(raw));
    return { story, sha: file.sha, htmlUrl: file.html_url };
  }

  async createStory(accessToken, user, owner, repoName, inputData, branch = "master") {
    this.#requireOwner(user, owner, repoName);
    const input = CreateStoryInputSchema.parse(inputData);
    const storyId = sanitizeStoryId(input.name);
    if (!storyId) {
      const err = new Error("Invalid story name");
      err.status = 400;
      throw err;
    }
    const now = new Date().toISOString();
    await this.#validateFrameArtworks(accessToken, owner, repoName, storyId, input.frames, branch);
    const story = StorySchema.parse({
      format: "gridcraft-story",
      schemaVersion: 1,
      id: storyId,
      name: input.name,
      description: input.description || "",
      loop: input.loop,
      defaultFrameDurationMs: input.defaultFrameDurationMs,
      frames: input.frames || [],
      createdAt: now,
      updatedAt: now,
    });

    const encoded = Buffer.from(JSON.stringify(story, null, 2), "utf8").toString("base64");
    const result = await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(this.#path(repoName, storyId))}`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `feat(story): add ${storyId}`,
          content: encoded,
          branch,
        }),
      }
    );

    return { story, sha: result.content.sha, commitSha: result.commit.sha };
  }

  async saveStory(accessToken, user, owner, repoName, storyId, body = {}, branch = "master") {
    this.#requireOwner(user, owner, repoName);
    const cleanId = sanitizeStoryId(storyId);
    if (!body.sha) {
      const err = new Error("Current story SHA is required to save changes safely.");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const current = await this.getStory(accessToken, owner, repoName, cleanId, branch);
    if (body.sha !== current.sha) {
      const err = new Error("The remote story changed. Reload it before saving.");
      err.status = 409;
      err.code = "CONFLICT";
      throw err;
    }
    const input = body.story || body;
    const updated = StorySchema.parse({
      ...input,
      format: "gridcraft-story",
      schemaVersion: 1,
      id: cleanId,
      updatedAt: new Date().toISOString(),
    });
    await this.#validateFrameArtworks(accessToken, owner, repoName, cleanId, updated.frames, branch);
    const encoded = Buffer.from(JSON.stringify(updated, null, 2), "utf8").toString("base64");
    const result = await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(this.#path(repoName, cleanId))}`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          message: body.commitMessage || `update(story): refine ${cleanId}`,
          content: encoded,
          branch,
          sha: body.sha,
        }),
      }
    );
    return { story: updated, sha: result.content.sha, commitSha: result.commit.sha };
  }

  async deleteStory(accessToken, user, owner, repoName, storyId, sha, branch = "master") {
    this.#requireOwner(user, owner, repoName);
    const cleanId = sanitizeStoryId(storyId);
    if (!sha) {
      const err = new Error("Current story SHA is required to delete this story safely.");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const current = await this.getStory(accessToken, owner, repoName, cleanId, branch);
    if (sha !== current.sha) {
      const err = new Error("The remote story changed. Reload it before deleting.");
      err.status = 409;
      err.code = "CONFLICT";
      throw err;
    }
    let artworkFiles = [];
    try {
      artworkFiles = await this.#request(
        `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(this.#albumPath(repoName, cleanId))}?ref=${encodeURIComponent(branch)}`,
        accessToken
      );
    } catch (err) {
      if (err.status !== 404) throw err;
    }
    for (const artwork of Array.isArray(artworkFiles) ? artworkFiles : []) {
      if (artwork.type !== "file" || artwork.name === "story.json") continue;
      await this.#request(
        `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(artwork.path)}`,
        accessToken,
        {
          method: "DELETE",
          body: JSON.stringify({
            message: `delete(story): remove artwork ${artwork.name}`,
            sha: artwork.sha,
            branch,
          }),
        }
      );
    }
    await this.#request(`/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(this.#path(repoName, cleanId))}`, accessToken, {
      method: "DELETE",
      body: JSON.stringify({
        message: `delete(story): remove ${cleanId}`,
        sha,
        branch,
      }),
    });
    return { success: true, storyId: cleanId };
  }

  async addFrame(accessToken, user, owner, repoName, storyId, frame, sha, branch = "master") {
    this.#requireOwner(user, owner, repoName);
    const current = await this.getStory(accessToken, owner, repoName, storyId, branch);
    const next = {
      ...current.story,
      frames: [
        ...current.story.frames,
        {
          artworkId: frame.artworkId,
          artworkPath: frame.artworkPath || `${frame.artworkId}.json`,
          durationMs: frame.durationMs || current.story.defaultFrameDurationMs,
        },
      ],
    };
    return this.saveStory(
      accessToken,
      user,
      owner,
      repoName,
      storyId,
      { story: next, sha: sha || current.sha, commitMessage: `update(story): add frame to ${storyId}` },
      branch
    );
  }

  async reorderFrames(accessToken, user, owner, repoName, storyId, frameIds, sha, branch = "master") {
    this.#requireOwner(user, owner, repoName);
    const current = await this.getStory(accessToken, owner, repoName, storyId, branch);
    const byId = new Map(current.story.frames.map((frame) => [frame.artworkId, frame]));
    const frames = frameIds.map((id) => {
      const frame = byId.get(id);
      if (!frame) {
        const err = new Error(`Unknown frame artworkId: ${id}`);
        err.status = 400;
        throw err;
      }
      return frame;
    });
    return this.saveStory(
      accessToken,
      user,
      owner,
      repoName,
      storyId,
      {
        story: { ...current.story, frames },
        sha: sha || current.sha,
        commitMessage: `update(story): reorder frames in ${storyId}`,
      },
      branch
    );
  }
}

export const storyService = new StoryService();
