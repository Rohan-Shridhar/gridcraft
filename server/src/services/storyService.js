import { CreateStoryInputSchema, StorySchema, sanitizeStoryId } from "../validators/storyValidator.js";
import { githubRequest } from "../utils/githubClient.js";

export class StoryService {
  constructor(fetchFn = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  async #request(endpoint, accessToken, options = {}) {
    const { data } = await githubRequest(this.fetch, endpoint, accessToken, options);
    return data;
  }

  #path(storyId) {
    return `stories/${storyId}/story.json`;
  }

  async listStories(accessToken, owner, repoName, branch = "master") {
    let entries;
    try {
      entries = await this.#request(
        `/repos/${owner}/${repoName}/contents/stories?ref=${encodeURIComponent(branch)}`,
        accessToken
      );
    } catch (err) {
      if (err.status === 404) return [];
      throw err;
    }

    if (!Array.isArray(entries)) return [];
    const folders = entries.filter((item) => item.type === "dir");

    const stories = await Promise.all(
      folders.map(async (folder) => {
        try {
          const detail = await this.getStory(accessToken, owner, repoName, folder.name, branch);
          return { ...detail.story, sha: detail.sha };
        } catch {
          return null;
        }
      })
    );

    return stories.filter(Boolean);
  }

  async getStory(accessToken, owner, repoName, storyId, branch = "master") {
    const cleanId = sanitizeStoryId(storyId);
    const file = await this.#request(
      `/repos/${owner}/${repoName}/contents/${this.#path(cleanId)}?ref=${encodeURIComponent(branch)}`,
      accessToken
    );
    const raw = Buffer.from(file.content, "base64").toString("utf8");
    const story = StorySchema.parse(JSON.parse(raw));
    return { story, sha: file.sha, htmlUrl: file.html_url };
  }

  async createStory(accessToken, user, owner, repoName, inputData, branch = "master") {
    const input = CreateStoryInputSchema.parse(inputData);
    const storyId = sanitizeStoryId(input.name);
    if (!storyId) {
      const err = new Error("Invalid story name");
      err.status = 400;
      throw err;
    }
    const now = new Date().toISOString();
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
      `/repos/${owner}/${repoName}/contents/${this.#path(storyId)}`,
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

    const readme = Buffer.from(
      `# ${story.name}\n\n${story.description || "A GridCraft story."}\n`,
      "utf8"
    ).toString("base64");
    try {
      await this.#request(
        `/repos/${owner}/${repoName}/contents/stories/${storyId}/README.md`,
        accessToken,
        {
          method: "PUT",
          body: JSON.stringify({
            message: `chore(story): add ${storyId} readme`,
            content: readme,
            branch,
          }),
        }
      );
    } catch {
      // README is optional
    }

    return { story, sha: result.content.sha, commitSha: result.commit.sha };
  }

  async saveStory(accessToken, user, owner, repoName, storyId, body = {}, branch = "master") {
    const cleanId = sanitizeStoryId(storyId);
    const input = body.story || body;
    const updated = StorySchema.parse({
      ...input,
      format: "gridcraft-story",
      schemaVersion: 1,
      id: cleanId,
      updatedAt: new Date().toISOString(),
    });
    const encoded = Buffer.from(JSON.stringify(updated, null, 2), "utf8").toString("base64");
    const result = await this.#request(
      `/repos/${owner}/${repoName}/contents/${this.#path(cleanId)}`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          message: body.commitMessage || `update(story): refine ${cleanId}`,
          content: encoded,
          branch,
          ...(body.sha ? { sha: body.sha } : {}),
        }),
      }
    );
    return { story: updated, sha: result.content.sha, commitSha: result.commit.sha };
  }

  async deleteStory(accessToken, user, owner, repoName, storyId, sha, branch = "master") {
    const cleanId = sanitizeStoryId(storyId);
    let fileSha = sha;
    if (!fileSha) {
      const current = await this.getStory(accessToken, owner, repoName, cleanId, branch);
      fileSha = current.sha;
    }
    await this.#request(`/repos/${owner}/${repoName}/contents/${this.#path(cleanId)}`, accessToken, {
      method: "DELETE",
      body: JSON.stringify({
        message: `delete(story): remove ${cleanId}`,
        sha: fileSha,
        branch,
      }),
    });
    return { success: true, storyId: cleanId };
  }

  async addFrame(accessToken, user, owner, repoName, storyId, frame, sha, branch = "master") {
    const current = await this.getStory(accessToken, owner, repoName, storyId, branch);
    const next = {
      ...current.story,
      frames: [
        ...current.story.frames,
        {
          artworkId: frame.artworkId,
          artworkPath: frame.artworkPath || `artworks/${frame.artworkId}.json`,
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
