import {
  ArtworkSchema,
  CreateArtworkInputSchema,
  sanitizeArtworkId,
} from "../validators/artworkValidator.js";
import { githubRequest } from "../utils/githubClient.js";
import { albumService, ARTWORKS_REPOSITORY } from "./albumService.js";
import { StorySchema, sanitizeStoryId } from "../validators/storyValidator.js";

function artworkDirectory(albumId, storyId) {
  return `${albumId}/${storyId}`;
}

function githubPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function parseArtworkFile(content, path) {
  try {
    if (!content) throw new Error("Artwork file has no readable content");
    const raw = Buffer.from(content, "base64").toString("utf8");
    return ArtworkSchema.parse(JSON.parse(raw));
  } catch (cause) {
    const err = new Error(`Invalid artwork file ${path}: ${cause.message}`, { cause });
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
}

export class ArtworkService {
  constructor(fetchFn = globalThis.fetch, store = albumService.store) {
    this.fetch = fetchFn;
    this.store = store;
  }

  async #request(endpoint, accessToken, options = {}) {
    const { data } = await githubRequest(this.fetch, endpoint, accessToken, options);
    return data;
  }

  async #requireStory(accessToken, owner, repoName, storyId, branch) {
    const album = this.store.getAlbum(owner, repoName);
    if (!album || album.slug !== repoName) {
      const err = new Error("Album was not found in GridCraft.");
      err.status = 404;
      throw err;
    }
    const cleanStoryId = sanitizeStoryId(storyId);
    if (!cleanStoryId || cleanStoryId !== storyId) {
      const err = new Error("Invalid story id");
      err.status = 400;
      throw err;
    }
    const { data: file } = await githubRequest(
      this.fetch,
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/contents/${githubPath(`${album.slug}/${cleanStoryId}/story.json`)}?ref=${encodeURIComponent(branch)}`,
      accessToken
    );
    if (!file?.content) {
      const err = new Error("The selected story could not be read.");
      err.status = 422;
      throw err;
    }
    StorySchema.parse(JSON.parse(Buffer.from(file.content, "base64").toString("utf8")));
  }

  async listArtworks(accessToken, owner, repoName, storyId, branch = "master") {
    await this.#requireStory(accessToken, owner, repoName, storyId, branch);
    let files;
    try {
      files = await this.#request(
        `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(artworkDirectory(repoName, storyId))}?ref=${encodeURIComponent(branch)}`,
        accessToken
      );
    } catch (err) {
      if (err.status === 404) {
        return [];
      }
      throw err;
    }

    if (!Array.isArray(files)) {
      return [];
    }

    // Filter only .json artwork files
    const jsonFiles = files.filter(
      (f) => f.name.endsWith(".json") && f.type === "file" && f.name !== "story.json"
    );

    // Fetch and decode each artwork
    return Promise.all(
      jsonFiles.map(async (file) => {
        const detail = await this.#request(
          `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(file.path)}?ref=${encodeURIComponent(branch)}`,
          accessToken
        );
        const validated = parseArtworkFile(detail?.content, file.path);
        return {
          ...validated,
          sha: detail.sha,
          downloadUrl: detail.download_url,
          htmlUrl: detail.html_url,
        };
      })
    );
  }

  async getArtwork(accessToken, owner, repoName, storyId, artworkId, branch = "master") {
    await this.#requireStory(accessToken, owner, repoName, storyId, branch);
    const cleanId = sanitizeArtworkId(artworkId);
    if (!cleanId) {
      const err = new Error("Invalid artwork id");
      err.status = 400;
      throw err;
    }

    const file = await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(`${artworkDirectory(repoName, storyId)}/${cleanId}.json`)}?ref=${encodeURIComponent(branch)}`,
      accessToken
    );

    if (!file || !file.content) {
      const err = new Error("Artwork content could not be read");
      err.status = 404;
      throw err;
    }

    const validated = parseArtworkFile(file.content, `${artworkDirectory(repoName, storyId)}/${cleanId}.json`);

    return {
      artwork: validated,
      sha: file.sha,
      downloadUrl: file.download_url,
      htmlUrl: file.html_url,
    };
  }

  async createArtwork(accessToken, user, owner, repoName, storyId, inputData, branch = "master") {
    this.#requireOwner(user, owner, repoName);
    await this.#requireStory(accessToken, owner, repoName, storyId, branch);
    const validatedInput = CreateArtworkInputSchema.parse(inputData);
    const artworkId = sanitizeArtworkId(validatedInput.name);

    if (!artworkId) {
      const err = new Error("Invalid artwork name resulting in empty identifier");
      err.status = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const cellCount = validatedInput.gridSize * validatedInput.gridSize;
    const initialCells = validatedInput.cells || Array(cellCount).fill(null);

    const artwork = {
      format: "gridcraft-artwork",
      schemaVersion: 1,
      id: artworkId,
      name: validatedInput.name,
      description: validatedInput.description || "",
      gridSize: validatedInput.gridSize,
      width: validatedInput.gridSize,
      height: validatedInput.gridSize,
      backgroundColor: validatedInput.backgroundColor || "transparent",
      cells: initialCells,
      createdAt: now,
      updatedAt: now,
    };

    ArtworkSchema.parse(artwork);

    const encoded = Buffer.from(JSON.stringify(artwork, null, 2), "utf8").toString("base64");
    const commitMessage = `feat(artwork): add ${artworkId}`;

    const result = await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(`${artworkDirectory(repoName, storyId)}/${artworkId}.json`)}`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          message: commitMessage,
          content: encoded,
          branch,
        }),
      }
    );

    return {
      artwork,
      sha: result.content.sha,
      commitSha: result.commit.sha,
    };
  }

  async saveArtwork(accessToken, user, owner, repoName, storyId, artworkId, body = {}, branch = "master") {
    this.#requireOwner(user, owner, repoName);
    await this.#requireStory(accessToken, owner, repoName, storyId, branch);
    const cleanId = sanitizeArtworkId(artworkId);
    if (!cleanId) {
      const err = new Error("Invalid artwork id");
      err.status = 400;
      throw err;
    }
    if (typeof body.sha !== "string" || !body.sha) {
      const err = new Error("Current artwork SHA is required to save changes safely.");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const artworkInput = body.artwork || (Array.isArray(body.cells) ? body : null);
    if (!artworkInput) {
      const err = new Error("Artwork payload is required");
      err.status = 400;
      throw err;
    }

    const updatedArtwork = {
      format: "gridcraft-artwork",
      schemaVersion: 1,
      createdAt: artworkInput.createdAt || new Date().toISOString(),
      ...artworkInput,
      id: cleanId,
      width: artworkInput.gridSize || artworkInput.width,
      height: artworkInput.gridSize || artworkInput.height,
      updatedAt: new Date().toISOString(),
    };

    ArtworkSchema.parse(updatedArtwork);

    const encoded = Buffer.from(JSON.stringify(updatedArtwork, null, 2), "utf8").toString("base64");
    const msg = body.commitMessage || `update(artwork): refine ${updatedArtwork.name || cleanId}`;

    const result = await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(`${artworkDirectory(repoName, storyId)}/${cleanId}.json`)}`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          message: msg,
          content: encoded,
          branch,
          sha: body.sha,
        }),
      }
    );

    return {
      artwork: updatedArtwork,
      sha: result.content.sha,
      commitSha: result.commit.sha,
    };
  }

  async renameArtwork(accessToken, user, owner, repoName, storyId, artworkId, { newName, sha, branch = "master" }) {
    this.#requireOwner(user, owner, repoName);
    await this.#requireStory(accessToken, owner, repoName, storyId, branch);
    if (typeof sha !== "string" || !sha) {
      const err = new Error("Current artwork SHA is required to rename this artwork safely.");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const current = await this.getArtwork(accessToken, owner, repoName, storyId, artworkId, branch);
    if (sha !== current.sha) {
      const err = new Error("The remote artwork changed. Reload it before renaming.");
      err.status = 409;
      err.code = "CONFLICT";
      throw err;
    }
    const nextId = sanitizeArtworkId(newName);
    if (!nextId) {
      const err = new Error("Invalid new artwork name");
      err.status = 400;
      throw err;
    }
    const renamed = {
      ...current.artwork,
      id: nextId,
      name: newName,
      updatedAt: new Date().toISOString(),
    };
    ArtworkSchema.parse(renamed);

    const encoded = Buffer.from(JSON.stringify(renamed, null, 2), "utf8").toString("base64");
    if (nextId === current.artwork.id) {
      const updated = await this.#request(
        `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(`${artworkDirectory(repoName, storyId)}/${nextId}.json`)}`,
        accessToken,
        {
          method: "PUT",
          body: JSON.stringify({
            message: `rename(artwork): ${current.artwork.name} to ${newName}`,
            content: encoded,
            sha: current.sha,
            branch,
          }),
        }
      );
      return {
        artwork: renamed,
        sha: updated.content.sha,
        commitSha: updated.commit.sha,
        artworkId: nextId,
      };
    }

    const created = await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(`${artworkDirectory(repoName, storyId)}/${nextId}.json`)}`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `rename(artwork): ${current.artwork.id} to ${nextId}`,
          content: encoded,
          branch,
        }),
      }
    );

    await this.deleteArtwork(
      accessToken,
      user,
      owner,
      repoName,
      storyId,
      current.artwork.id,
      sha || current.sha,
      branch
    );

    return {
      artwork: renamed,
      sha: created.content.sha,
      commitSha: created.commit.sha,
      artworkId: nextId,
    };
  }

  async deleteArtwork(accessToken, user, owner, repoName, storyId, artworkId, sha, branch = "master") {
    this.#requireOwner(user, owner, repoName);
    await this.#requireStory(accessToken, owner, repoName, storyId, branch);
    const cleanId = sanitizeArtworkId(artworkId);
    if (!cleanId) {
      const err = new Error("Invalid artwork id");
      err.status = 400;
      throw err;
    }
    if (typeof sha !== "string" || !sha) {
      const err = new Error("Current artwork SHA is required to delete this artwork safely.");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/contents/${githubPath(`${artworkDirectory(repoName, storyId)}/${cleanId}.json`)}`,
      accessToken,
      {
        method: "DELETE",
        body: JSON.stringify({
          message: `delete(artwork): remove ${cleanId}`,
          sha,
          branch,
        }),
      }
    );

    return { success: true, artworkId: cleanId };
  }

  async getArtworkHistory(accessToken, owner, repoName, storyId, artworkId, branch = "master") {
    await this.#requireStory(accessToken, owner, repoName, storyId, branch);
    const cleanId = sanitizeArtworkId(artworkId);
    const commits = await this.#request(
      `/repos/${owner}/${ARTWORKS_REPOSITORY}/commits?path=${encodeURIComponent(`${artworkDirectory(repoName, storyId)}/${cleanId}.json`)}&sha=${encodeURIComponent(branch)}&per_page=15`,
      accessToken
    );

    return (commits || []).map((c) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.commit.message,
      author: c.commit.author.name,
      authorLogin: c.author?.login || c.commit.author.name,
      authorAvatar: c.author?.avatar_url || null,
      date: c.commit.author.date,
      htmlUrl: c.html_url,
    }));
  }

  #requireOwner(user, owner, albumId) {
    if (user?.login?.toLowerCase() !== owner.toLowerCase()) {
      const err = new Error("Only the album owner can edit artwork files.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    if (!this.store.getAlbum(owner, albumId)) {
      const err = new Error("Album was not found in GridCraft.");
      err.status = 404;
      throw err;
    }
  }
}

export const artworkService = new ArtworkService();
