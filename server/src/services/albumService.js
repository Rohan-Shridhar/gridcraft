import {
  AlbumManifestSchema,
  CreateAlbumSchema,
  UpdateAlbumSchema,
  slugifyRepoName,
} from "../validators/albumValidator.js";
import { APP_VERSION } from "../config/version.js";
import { githubRequest } from "../utils/githubClient.js";
import { appStore } from "./appStore.js";

export const ARTWORKS_REPOSITORY = "gridcraft-artworks";

function albumPath(slug) {
  return slug;
}

function mapAlbumToApi(album) {
  const branch = album.defaultBranch || "master";
  const htmlUrl = `https://github.com/${album.owner}/${ARTWORKS_REPOSITORY}/tree/${encodeURIComponent(branch)}/${albumPath(album.slug)}`;
  return {
    id: album.id,
    name: album.name,
    slug: album.slug,
    fullName: `${album.owner}/${ARTWORKS_REPOSITORY}/${albumPath(album.slug)}`,
    owner: album.owner,
    ownerAvatar: album.ownerAvatar || null,
    description: album.description,
    isPrivate: false,
    defaultBranch: branch,
    htmlUrl,
    updatedAt: album.updatedAt,
    createdAt: album.createdAt,
    isGridCraftAlbum: true,
    fork: Boolean(album.parent),
    parent: album.parent
      ? {
          owner: album.parent.owner,
          name: album.parent.slug,
          slug: album.parent.slug,
          fullName:           `${album.parent.owner}/${ARTWORKS_REPOSITORY}/${albumPath(album.parent.slug)}`,
          htmlUrl: `https://github.com/${album.parent.owner}/${ARTWORKS_REPOSITORY}/tree/${encodeURIComponent(album.defaultBranch || "master")}/${albumPath(album.parent.slug)}`,
        }
      : null,
  };
}

export class AlbumService {
  constructor(fetchFn = globalThis.fetch, store = appStore) {
    this.fetch = fetchFn;
    this.store = store;
  }

  async #request(endpoint, accessToken, options = {}) {
    return githubRequest(this.fetch, endpoint, accessToken, options);
  }

  async #getRepository(accessToken, owner) {
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}`,
      accessToken
    );
    return data;
  }

  async #ensureRepository(accessToken, user) {
    let repository;
    try {
      repository = await this.#getRepository(accessToken, user.login);
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    if (!repository) {
      try {
        const { data } = await this.#request("/user/repos", accessToken, {
          method: "POST",
          body: JSON.stringify({
            name: ARTWORKS_REPOSITORY,
            description: "GridCraft albums, stories, and pixel artworks",
            private: false,
            auto_init: true,
          }),
          retry: false,
        });
        repository = data;
      } catch (error) {
        if (error.status !== 422) throw error;
        repository = await this.#getRepository(accessToken, user.login);
      }
    }

    if (repository.private) {
      const error = new Error(
        `Make ${user.login}/${ARTWORKS_REPOSITORY} public before creating shared GridCraft albums.`
      );
      error.status = 409;
      throw error;
    }

    const rootPath = ".gridcraft/catalog.json";
    const defaultBranch = repository.default_branch || "master";
    try {
      await this.#readFile(accessToken, user.login, rootPath, defaultBranch);
    } catch (error) {
      if (error.status !== 404) throw error;
      await this.#writeFile(
        accessToken,
        user.login,
        rootPath,
        JSON.stringify({ format: "gridcraft-artworks", schemaVersion: 1 }, null, 2),
        "chore: initialize GridCraft artwork library",
        defaultBranch
      );
    }
    this.store.upsertUser(user);
    this.store.setUserDefaultBranch(user.id, defaultBranch);
    return repository;
  }

  async #syncUserAlbums(accessToken, user, repository) {
    const branch = repository.default_branch || "master";
    const { data: tree } = await this.#request(
      `/repos/${encodeURIComponent(user.login)}/${ARTWORKS_REPOSITORY}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      accessToken
    );
    if (tree.truncated) {
      const error = new Error("The artwork library is too large to safely index.");
      error.status = 422;
      throw error;
    }

    this.store.upsertUser(user);
    this.store.setUserDefaultBranch(user.id, branch);
    const manifests = (tree.tree || []).filter(
      (item) => item.type === "blob" && /^[^/]+\/album\.json$/.test(item.path)
    );
    for (const item of manifests) {
      const slug = item.path.split("/")[0];
      const file = await this.#readFile(accessToken, user.login, item.path, branch);
      const manifest = AlbumManifestSchema.parse(
        JSON.parse(Buffer.from(file.content, "base64").toString("utf8"))
      );
      if (manifest.id !== slug) {
        const error = new Error(`Album manifest id does not match its folder: ${item.path}`);
        error.status = 422;
        throw error;
      }
      const parentAlbumId = manifest.parent
        ? this.store.getAlbum(manifest.parent.owner, manifest.parent.slug)?.id || null
        : null;
      this.store.upsertAlbum(user, {
        slug,
        name: manifest.name,
        description: manifest.description,
        createdAt: manifest.createdAt,
        updatedAt: manifest.updatedAt,
        parentAlbumId,
      });
    }
  }

  async #readFile(accessToken, owner, filePath, branch = "master") {
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      accessToken
    );
    return data;
  }

  async #writeFile(accessToken, owner, filePath, content, message, branch = "master", sha) {
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/contents/${encodedPath}`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          message,
          content: Buffer.from(content, "utf8").toString("base64"),
          branch,
          ...(sha ? { sha } : {}),
        }),
      }
    );
    return data;
  }

  #requireOwner(user, owner) {
    if (user?.login?.toLowerCase() !== owner.toLowerCase()) {
      const error = new Error("Only the owner can change files in this album.");
      error.status = 403;
      error.code = "FORBIDDEN";
      throw error;
    }
  }

  async listAlbums(accessToken, { page = 1, perPage = 30, user } = {}) {
    if (user?.id && user.login) {
      const repository = await this.#ensureRepository(accessToken, user);
      await this.#syncUserAlbums(accessToken, user, repository);
    }
    const result = this.store.listAlbums({ page, perPage });
    const albums = result.albums.map(mapAlbumToApi);
    return { ...result, albums };
  }

  async createAlbum(accessToken, user, inputData) {
    const validated = CreateAlbumSchema.parse(inputData);
    const slug = slugifyRepoName(validated.name);
    if (!slug) {
      const error = new Error("Invalid album name.");
      error.status = 400;
      throw error;
    }

    const repository = await this.#ensureRepository(accessToken, user);
    await this.#syncUserAlbums(accessToken, user, repository);
    if (this.store.getAlbum(user.login, slug)) {
      const error = new Error(`Album "${slug}" already exists.`);
      error.status = 409;
      throw error;
    }

    const now = new Date().toISOString();
    const manifest = AlbumManifestSchema.parse({
      format: "gridcraft-album",
      schemaVersion: 1,
      id: slug,
      name: validated.name,
      description: validated.description,
      createdAt: now,
      updatedAt: now,
      createdWith: { name: "GridCraft", version: APP_VERSION },
    });
    await this.#writeFile(
      accessToken,
      user.login,
      `${albumPath(slug)}/album.json`,
      JSON.stringify(manifest, null, 2),
      `feat(album): add ${slug}`,
      repository.default_branch || "master"
    );
    const album = this.store.createAlbum(user, {
      slug,
      name: validated.name,
      description: validated.description,
    });
    return {
      repo: mapAlbumToApi(album),
      manifest,
    };
  }

  async forkAlbum(accessToken, user, owner, slug) {
    const source = this.store.getAlbum(owner, slug);
    if (!source) {
      const error = new Error("Album was not found in GridCraft.");
      error.status = 404;
      throw error;
    }
    let forkSlug = source.slug;
    let suffix = 2;
    while (this.store.getAlbum(user.login, forkSlug)) {
      forkSlug = `${source.slug}-${suffix}`;
      suffix += 1;
    }

    const destinationRepo = await this.#ensureRepository(accessToken, user);
    const sourceRepo = await this.#getRepository(accessToken, source.owner);
    const branch = sourceRepo.default_branch || "master";
    const { data: tree } = await this.#request(
      `/repos/${encodeURIComponent(source.owner)}/${ARTWORKS_REPOSITORY}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      accessToken
    );
    if (tree.truncated) {
      const error = new Error("The source artwork library is too large to safely fork.");
      error.status = 422;
      throw error;
    }
    const sourcePrefix = `${albumPath(source.slug)}/`;
    const files = (tree.tree || []).filter(
      (item) => item.type === "blob" && item.path.startsWith(sourcePrefix)
    );
    let manifest;
    const copies = [];
    for (const item of files) {
      const relativePath = item.path.slice(sourcePrefix.length);
      const { data: file } = await this.#request(
        `/repos/${encodeURIComponent(source.owner)}/${ARTWORKS_REPOSITORY}/git/blobs/${encodeURIComponent(item.sha)}`,
        accessToken
      );
      if (file.encoding !== "base64" || typeof file.content !== "string") {
        const error = new Error(`Source artwork file could not be read: ${item.path}`);
        error.status = 422;
        throw error;
      }
      let content = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
      if (relativePath === "album.json") {
        manifest = AlbumManifestSchema.parse(JSON.parse(content));
        manifest = AlbumManifestSchema.parse({
          ...manifest,
          id: forkSlug,
          name: `${source.name} (fork)`.slice(0, 100),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          parent: { owner: source.owner, slug: source.slug },
        });
        content = JSON.stringify(manifest, null, 2);
      }
      copies.push({ path: `${albumPath(forkSlug)}/${relativePath}`, content });
    }

    if (!manifest) {
      const error = new Error("Source album is missing its album manifest.");
      error.status = 422;
      throw error;
    }
    const writtenFiles = [];
    try {
      for (const copy of copies) {
        const result = await this.#writeFile(
          accessToken,
          user.login,
          copy.path,
          copy.content,
          `fork(album): copy ${source.owner}/${source.slug}`,
          destinationRepo.default_branch || "master"
        );
        writtenFiles.push({ path: copy.path, sha: result.content.sha });
      }
    } catch (error) {
      const cleanupErrors = [];
      for (const file of writtenFiles.reverse()) {
        try {
          const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
          await this.#request(
            `/repos/${encodeURIComponent(user.login)}/${ARTWORKS_REPOSITORY}/contents/${encodedPath}`,
            accessToken,
            {
              method: "DELETE",
              body: JSON.stringify({
                message: `cleanup(fork): remove incomplete ${forkSlug}`,
                sha: file.sha,
                branch: destinationRepo.default_branch || "master",
              }),
            }
          );
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError.message);
        }
      }
      if (cleanupErrors.length) {
        error.message = `${error.message} Partial fork cleanup failed: ${cleanupErrors.join("; ")}`;
        error.partialWriteCleanupFailed = true;
      }
      throw error;
    }
    const album = this.store.createAlbum(user, {
      slug: forkSlug,
      name: manifest.name,
      description: manifest.description,
      parentAlbumId: source.id,
    });
    return { repo: mapAlbumToApi(album), manifest };
  }

  async getAlbum(accessToken, owner, slug) {
    let album = this.store.getAlbum(owner, slug);
    let rootRepo;
    if (!album) {
      rootRepo = await this.#getRepository(accessToken, owner);
      if (rootRepo.owner?.id && rootRepo.owner?.login) {
        await this.#syncUserAlbums(
          accessToken,
          {
            id: rootRepo.owner.id,
            login: rootRepo.owner.login,
            name: rootRepo.owner.name || rootRepo.owner.login,
            avatarUrl: rootRepo.owner.avatar_url,
            htmlUrl: rootRepo.owner.html_url,
          },
          rootRepo
        );
        album = this.store.getAlbum(owner, slug);
      }
    }
    if (!album) {
      const error = new Error("Album was not found in GridCraft.");
      error.status = 404;
      throw error;
    }
    rootRepo ||= await this.#getRepository(accessToken, owner);
    this.store.setUserDefaultBranch(album.ownerId, rootRepo.default_branch || "master");
    const file = await this.#readFile(accessToken, owner, `${albumPath(album.slug)}/album.json`, rootRepo.default_branch || "master");
    const manifest = AlbumManifestSchema.parse(
      JSON.parse(Buffer.from(file.content, "base64").toString("utf8"))
    );
    return {
      repo: {
        ...mapAlbumToApi(album),
        defaultBranch: rootRepo.default_branch || "master",
        ownerAvatar: rootRepo.owner?.avatar_url || null,
        permissions: rootRepo.permissions || {},
        fork: Boolean(album.parent),
        parent: album.parent,
        topics: ["gridcraft"],
      },
      manifest,
      isGridCraftAlbum: true,
    };
  }

  async updateAlbum(accessToken, user, owner, slug, inputData) {
    this.#requireOwner(user, owner);
    const validated = UpdateAlbumSchema.parse(inputData);
    const album = this.store.getAlbum(owner, slug);
    if (!album) {
      const error = new Error("Album was not found in GridCraft.");
      error.status = 404;
      throw error;
    }
    const filePath = `${albumPath(album.slug)}/album.json`;
    const rootRepo = await this.#getRepository(accessToken, owner);
    const branch = rootRepo.default_branch || "master";
    const file = await this.#readFile(accessToken, owner, filePath, branch);
    const currentManifest = AlbumManifestSchema.parse(
      JSON.parse(Buffer.from(file.content, "base64").toString("utf8"))
    );
    const manifest = AlbumManifestSchema.parse({
      ...currentManifest,
      name: validated.name || currentManifest.name,
      description: validated.description ?? currentManifest.description,
      updatedAt: new Date().toISOString(),
    });
    await this.#writeFile(
      accessToken,
      owner,
      filePath,
      JSON.stringify(manifest, null, 2),
      `update(album): ${album.slug}`,
      branch,
      file.sha
    );
    const updatedAlbum = this.store.updateAlbum(album.id, {
      name: manifest.name,
      description: manifest.description,
    });
    return {
      repo: mapAlbumToApi(updatedAlbum),
      manifest,
      isGridCraftAlbum: true,
    };
  }

  async deleteAlbum(accessToken, user, owner, slug, confirmName) {
    this.#requireOwner(user, owner);
    const album = this.store.getAlbum(owner, slug);
    if (!album) {
      const error = new Error("Album was not found in GridCraft.");
      error.status = 404;
      throw error;
    }
    if (confirmName !== slug && confirmName !== album.name) {
      const error = new Error("Confirmation name does not match the album.");
      error.status = 400;
      throw error;
    }
    const rootRepo = await this.#getRepository(accessToken, owner);
    const branch = rootRepo.default_branch || "master";
    const tree = await this.getTree(accessToken, owner, slug, branch);
    for (const item of tree.sort((left, right) => right.path.length - left.path.length)) {
      if (item.type !== "blob") continue;
      const file = await this.#readFile(accessToken, owner, item.path, branch);
      const encodedPath = item.path.split("/").map(encodeURIComponent).join("/");
      await this.#request(`/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/contents/${encodedPath}`, accessToken, {
        method: "DELETE",
        body: JSON.stringify({
          message: `delete(album): remove ${slug}`,
          sha: file.sha,
          branch,
        }),
      });
    }
    this.store.deleteAlbum(album.id);
    return { success: true, message: `Album ${slug} and its GitHub files were deleted.` };
  }

  async listCommits(accessToken, owner, slug, branch = "master") {
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/commits?path=${encodeURIComponent(albumPath(slug))}&sha=${encodeURIComponent(branch)}&per_page=20`,
      accessToken
    );
    return (data || []).map((commit) => ({
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      message: commit.commit.message,
      author: commit.commit.author?.name,
      authorLogin: commit.author?.login || commit.commit.author?.name,
      authorAvatar: commit.author?.avatar_url || null,
      date: commit.commit.author?.date,
      htmlUrl: commit.html_url,
    }));
  }

  async getTree(accessToken, owner, slug, branch = "master") {
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      accessToken
    );
    const prefix = `${albumPath(slug)}/`;
    return (data.tree || [])
      .filter((item) => item.path.startsWith(prefix))
      .map((item) => ({
        path: item.path,
        mode: item.mode,
        type: item.type,
        sha: item.sha,
        size: item.size,
      }));
  }

  async initializeExistingRepo(accessToken, user) {
    return this.#ensureRepository(accessToken, user);
  }
}

export const albumService = new AlbumService();
