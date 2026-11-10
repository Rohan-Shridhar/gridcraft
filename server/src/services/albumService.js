import {
  AlbumManifestSchema,
  CreateAlbumSchema,
  UpdateAlbumSchema,
  slugifyRepoName,
} from "../validators/albumValidator.js";
import { APP_VERSION } from "../config/version.js";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": `GridCraft/${APP_VERSION}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

export class AlbumService {
  constructor(fetchFn = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  async #request(endpoint, accessToken, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${GITHUB_API_URL}${endpoint}`;
    const headers = {
      ...GITHUB_API_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    };

    const response = await this.fetch(url, { ...options, headers });

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const err = new Error(data?.message || `GitHub API request failed with status ${response.status}`);
      err.status = response.status;
      err.githubData = data;
      throw err;
    }

    return data;
  }

  async listAlbums(accessToken, { page = 1, perPage = 30 } = {}) {
    const repos = await this.#request(
      `/user/repos?type=all&sort=updated&per_page=${perPage}&page=${page}`,
      accessToken
    );

    // Filter or tag GridCraft albums
    const albums = repos.map((repo) => {
      const topics = repo.topics || [];
      const isGridCraft =
        topics.includes("gridcraft-album") ||
        topics.includes("gridcraft") ||
        repo.description?.toLowerCase().includes("gridcraft");

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        ownerAvatar: repo.owner.avatar_url,
        description: repo.description || "",
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at,
        createdAt: repo.created_at,
        isGridCraftAlbum: isGridCraft,
        permissions: repo.permissions || {},
        fork: repo.fork,
      };
    });

    return {
      albums,
      page,
      perPage,
      total: albums.length,
    };
  }

  async createAlbum(accessToken, user, inputData) {
    const validated = CreateAlbumSchema.parse(inputData);
    const repoName = slugifyRepoName(validated.name);

    if (!repoName) {
      const err = new Error("Invalid repository name.");
      err.status = 400;
      throw err;
    }

    // 1. Create GitHub repository under authenticated user's account
    let repo;
    try {
      repo = await this.#request("/user/repos", accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: repoName,
          description: validated.description || "GridCraft pixel art album",
          private: !!validated.isPrivate,
          auto_init: true, // Creates initial commit so branches exist
        }),
      });
    } catch (err) {
      if (err.status === 422) {
        const error = new Error(`Repository "${repoName}" already exists or name is unavailable.`);
        error.status = 409;
        throw error;
      }
      throw err;
    }

    const owner = repo.owner.login;
    let currentDefaultBranch = repo.default_branch || "main";

    // 2. Ensure default branch is "master"
    if (currentDefaultBranch !== "master") {
      try {
        await this.#request(`/repos/${owner}/${repoName}/branches/${currentDefaultBranch}/rename`, accessToken, {
          method: "POST",
          body: JSON.stringify({ new_name: "master" }),
        });
      } catch (renameErr) {
        // Fallback: If branch rename API fails, attempt to create master ref and update repo default branch
        try {
          const refData = await this.#request(`/repos/${owner}/${repoName}/git/ref/heads/${currentDefaultBranch}`, accessToken);
          const sha = refData.object.sha;
          await this.#request(`/repos/${owner}/${repoName}/git/refs`, accessToken, {
            method: "POST",
            body: JSON.stringify({ ref: "refs/heads/master", sha }),
          });
          await this.#request(`/repos/${owner}/${repoName}`, accessToken, {
            method: "PATCH",
            body: JSON.stringify({ default_branch: "master" }),
          });
        } catch {
          console.warn("Could not rename or switch default branch to master:", renameErr.message);
        }
      }

      // Verify default branch is indeed "master"
      const verifiedRepo = await this.#request(`/repos/${owner}/${repoName}`, accessToken);
      if (verifiedRepo.default_branch !== "master") {
        const err = new Error(
          `Failed to set default branch to "master". Repository initial branch remained "${verifiedRepo.default_branch}".`
        );
        err.status = 502;
        throw err;
      }
      repo = verifiedRepo;
    }

    // 3. Set topics: ["gridcraft", "gridcraft-album"]
    try {
      await this.#request(`/repos/${owner}/${repoName}/topics`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ names: ["gridcraft", "gridcraft-album"] }),
      });
    } catch (topicErr) {
      console.warn("Setting repository topics non-fatal error:", topicErr.message);
    }

    // 4. Construct album manifest
    const manifest = {
      format: "gridcraft-album",
      schemaVersion: 1,
      id: repoName,
      name: validated.name,
      description: validated.description || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdWith: {
        name: "GridCraft",
        version: APP_VERSION,
      },
    };

    AlbumManifestSchema.parse(manifest);

    // 5. Commit initial album manifest and directory structures
    const commitFile = async (filePath, content, message) => {
      const encoded = Buffer.from(content, "utf8").toString("base64");
      return this.#request(`/repos/${owner}/${repoName}/contents/${filePath}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          message,
          content: encoded,
          branch: "master",
        }),
      });
    };

    const readmeContent =
      validated.readme ||
      `# ${validated.name}\n\n${validated.description || "A pixel art album created with GridCraft."}\n\n## Repository Structure\n- \`.gridcraft/album.json\`: Album manifest\n- \`artworks/\`: Pixel art canvas files\n- \`stories/\`: Story animations and playlists\n\nCreated with [GridCraft](https://github.com/Rohan-Shridhar/gridcraft).\n`;

    // Commit files in master branch
    await commitFile(
      ".gridcraft/album.json",
      JSON.stringify(manifest, null, 2),
      "chore(gridcraft): initialize album manifest"
    );

    await commitFile(
      "artworks/.gitkeep",
      "",
      "chore(gridcraft): initialize artworks directory"
    );

    await commitFile(
      "stories/.gitkeep",
      "",
      "chore(gridcraft): initialize stories directory"
    );

    // Update README if default was created during auto_init
    try {
      const existingReadme = await this.#request(
        `/repos/${owner}/${repoName}/contents/README.md?ref=master`,
        accessToken
      ).catch(() => null);

      const encodedReadme = Buffer.from(readmeContent, "utf8").toString("base64");
      await this.#request(`/repos/${owner}/${repoName}/contents/README.md`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          message: "docs(gridcraft): initialize album documentation",
          content: encodedReadme,
          branch: "master",
          ...(existingReadme?.sha ? { sha: existingReadme.sha } : {}),
        }),
      });
    } catch (readmeErr) {
      console.warn("Non-fatal README update error:", readmeErr.message);
    }

    return {
      repo: {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        ownerAvatar: repo.owner.avatar_url,
        description: repo.description,
        isPrivate: repo.private,
        defaultBranch: "master",
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at,
        createdAt: repo.created_at,
      },
      manifest,
    };
  }

  async getAlbum(accessToken, owner, repoName) {
    const repo = await this.#request(`/repos/${owner}/${repoName}`, accessToken);

    let manifest = null;
    let isGridCraftAlbum = false;

    try {
      const file = await this.#request(
        `/repos/${owner}/${repoName}/contents/.gridcraft/album.json?ref=master`,
        accessToken
      );
      if (file && file.content) {
        const rawJson = Buffer.from(file.content, "base64").toString("utf8");
        const parsed = JSON.parse(rawJson);
        manifest = AlbumManifestSchema.parse(parsed);
        isGridCraftAlbum = true;
      }
    } catch {
      // Not a GridCraft album or manifest missing
    }

    return {
      repo: {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        ownerAvatar: repo.owner.avatar_url,
        description: repo.description || "",
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at,
        createdAt: repo.created_at,
        permissions: repo.permissions || {},
        fork: repo.fork,
        parent: repo.parent
          ? {
              fullName: repo.parent.full_name,
              owner: repo.parent.owner?.login,
              name: repo.parent.name,
              htmlUrl: repo.parent.html_url,
              defaultBranch: repo.parent.default_branch,
            }
          : null,
        source: repo.source
          ? {
              fullName: repo.source.full_name,
              owner: repo.source.owner?.login,
              name: repo.source.name,
              htmlUrl: repo.source.html_url,
              defaultBranch: repo.source.default_branch,
            }
          : null,
        topics: repo.topics || [],
      },
      manifest,
      isGridCraftAlbum,
    };
  }

  async updateAlbum(accessToken, owner, repoName, inputData) {
    const validated = UpdateAlbumSchema.parse(inputData);

    const updatePayload = {};
    if (validated.description !== undefined) {
      updatePayload.description = validated.description;
    }
    if (validated.isPrivate !== undefined) {
      updatePayload.private = validated.isPrivate;
    }

    let updatedRepo = null;
    if (Object.keys(updatePayload).length > 0) {
      updatedRepo = await this.#request(`/repos/${owner}/${repoName}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify(updatePayload),
      });
    }

    return this.getAlbum(accessToken, owner, repoName);
  }

  async deleteAlbum(accessToken, owner, repoName, confirmName) {
    if (confirmName !== repoName) {
      const err = new Error(`Confirmation name "${confirmName}" does not match repository name "${repoName}".`);
      err.status = 400;
      throw err;
    }

    await this.#request(`/repos/${owner}/${repoName}`, accessToken, {
      method: "DELETE",
    });

    return { success: true, message: `Album ${owner}/${repoName} deleted.` };
  }

  async listCommits(accessToken, owner, repoName, branch = "master") {
    const commits = await this.#request(
      `/repos/${owner}/${repoName}/commits?sha=${branch}&per_page=20`,
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

  async getTree(accessToken, owner, repoName, branch = "master") {
    try {
      const treeData = await this.#request(
        `/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`,
        accessToken
      );

      return (treeData.tree || []).map((item) => ({
        path: item.path,
        mode: item.mode,
        type: item.type, // 'blob' or 'tree'
        sha: item.sha,
        size: item.size,
      }));
    } catch (err) {
      console.warn("Tree fetch failed:", err.message);
      return [];
    }
  }

  async initializeExistingRepo(accessToken, user, owner, repoName) {
    const albumData = await this.getAlbum(accessToken, owner, repoName);
    if (albumData.isGridCraftAlbum && albumData.manifest) {
      return albumData;
    }

    const manifest = {
      format: "gridcraft-album",
      schemaVersion: 1,
      id: repoName,
      name: albumData.repo.name,
      description: albumData.repo.description || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdWith: {
        name: "GridCraft",
        version: APP_VERSION,
      },
    };

    AlbumManifestSchema.parse(manifest);

    // Commit .gridcraft/album.json
    const encoded = Buffer.from(JSON.stringify(manifest, null, 2), "utf8").toString("base64");
    await this.#request(
      `/repos/${owner}/${repoName}/contents/.gridcraft/album.json`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          message: "chore(gridcraft): initialize album manifest",
          content: encoded,
          branch: albumData.repo.defaultBranch || "master",
        }),
      }
    );

    return this.getAlbum(accessToken, owner, repoName);
  }
}

export const albumService = new AlbumService();
