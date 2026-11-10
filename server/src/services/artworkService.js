import {
  ArtworkSchema,
  CreateArtworkInputSchema,
  sanitizeArtworkId,
} from "../validators/artworkValidator.js";
import { githubRequest } from "../utils/githubClient.js";

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
  constructor(fetchFn = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  async #request(endpoint, accessToken, options = {}) {
    const { data } = await githubRequest(this.fetch, endpoint, accessToken, options);
    return data;
  }

  async listArtworks(accessToken, owner, repoName, branch = "master") {
    let files;
    try {
      files = await this.#request(
        `/repos/${owner}/${repoName}/contents/artworks?ref=${encodeURIComponent(branch)}`,
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
      (f) => f.name.endsWith(".json") && f.type === "file" && f.name !== ".gitkeep"
    );

    // Fetch and decode each artwork
    return Promise.all(
      jsonFiles.map(async (file) => {
        const detail = await this.#request(
          `/repos/${owner}/${repoName}/contents/${file.path}?ref=${encodeURIComponent(branch)}`,
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

  async getArtwork(accessToken, owner, repoName, artworkId, branch = "master") {
    const cleanId = sanitizeArtworkId(artworkId);
    if (!cleanId) {
      const err = new Error("Invalid artwork id");
      err.status = 400;
      throw err;
    }

    const file = await this.#request(
      `/repos/${owner}/${repoName}/contents/artworks/${cleanId}.json?ref=${encodeURIComponent(branch)}`,
      accessToken
    );

    if (!file || !file.content) {
      const err = new Error("Artwork content could not be read");
      err.status = 404;
      throw err;
    }

    const validated = parseArtworkFile(file.content, `artworks/${cleanId}.json`);

    return {
      artwork: validated,
      sha: file.sha,
      downloadUrl: file.download_url,
      htmlUrl: file.html_url,
    };
  }

  async createArtwork(accessToken, user, owner, repoName, inputData, branch = "master") {
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
      `/repos/${owner}/${repoName}/contents/artworks/${artworkId}.json`,
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

  async saveArtwork(accessToken, user, owner, repoName, artworkId, body = {}, branch = "master") {
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
      `/repos/${owner}/${repoName}/contents/artworks/${cleanId}.json`,
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

  async renameArtwork(accessToken, user, owner, repoName, artworkId, { newName, sha, branch = "master" }) {
    if (typeof sha !== "string" || !sha) {
      const err = new Error("Current artwork SHA is required to rename this artwork safely.");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const current = await this.getArtwork(accessToken, owner, repoName, artworkId, branch);
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
        `/repos/${owner}/${repoName}/contents/artworks/${nextId}.json`,
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
      `/repos/${owner}/${repoName}/contents/artworks/${nextId}.json`,
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

  async deleteArtwork(accessToken, user, owner, repoName, artworkId, sha, branch = "master") {
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
      `/repos/${owner}/${repoName}/contents/artworks/${cleanId}.json`,
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

  async getArtworkHistory(accessToken, owner, repoName, artworkId, branch = "master") {
    const cleanId = sanitizeArtworkId(artworkId);
    const commits = await this.#request(
      `/repos/${owner}/${repoName}/commits?path=artworks/${cleanId}.json&sha=${encodeURIComponent(branch)}&per_page=15`,
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
}

export const artworkService = new ArtworkService();
