import {
  AlbumManifestSchema,
  CreateAlbumSchema,
  UpdateAlbumSchema,
  slugifyRepoName,
} from "../validators/albumValidator.js";
import { APP_VERSION } from "../config/version.js";
import { githubRequest } from "../utils/githubClient.js";
import { appStore } from "./appStore.js";
import { config } from "../config/env.js";

export const ARTWORKS_REPOSITORY = "gridcraft-artworks";

function setupError(originalError, status, code, userMessage) {
  const error = new Error(originalError.message);
  error.status = status;
  error.code = code;
  error.userMessage = userMessage;
  error.installUrl = `https://github.com/apps/${encodeURIComponent(config.github.appSlug)}/installations/new`;
  error.stage = originalError.stage;
  error.githubMethod = originalError.githubMethod;
  error.githubPath = originalError.githubPath;
  error.githubStatus = originalError.githubStatus ?? originalError.status;
  return error;
}

function librarySetupRequired(error) {
  return setupError(
    error,
    409,
    "LIBRARY_SETUP_REQUIRED",
    "Create a public repository named gridcraft-artworks (with a README) on your GitHub account, then install the gridcraft-auth GitHub App on it."
  );
}

function appNotInstalled(error) {
  return setupError(
    error,
    403,
    "APP_NOT_INSTALLED",
    "Install the gridcraft-auth GitHub App on your gridcraft-artworks repository, then retry."
  );
}

function appPermissionDenied(error) {
  return setupError(
    error,
    403,
    "APP_PERMISSION_DENIED",
    "gridcraft-auth needs Contents: Read and write on gridcraft-artworks. Accept any pending permission update."
  );
}

function albumPath(slug) {
  return slug;
}

function normalizePagination(page, perPage) {
  const parsedPage = Number.parseInt(page, 10);
  const parsedPerPage = Number.parseInt(perPage, 10);
  return {
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    perPage:
      Number.isFinite(parsedPerPage) && parsedPerPage > 0
        ? Math.min(100, parsedPerPage)
        : 30,
  };
}

function parseManifestFile(file, filePath) {
  if (!file || typeof file.content !== "string" || !file.content) {
    const error = new Error(`Album manifest has no readable content: ${filePath}`);
    error.status = 422;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  return AlbumManifestSchema.parse(
    JSON.parse(Buffer.from(file.content, "base64").toString("utf8"))
  );
}

function mapAlbumToApi(album) {
  const branch = album.defaultBranch || "master";
  const parentBranch = album.parent?.defaultBranch || branch;
  const htmlUrl = `https://github.com/${encodeURIComponent(album.owner)}/${ARTWORKS_REPOSITORY}/tree/${encodeURIComponent(branch)}/${albumPath(album.slug)}`;
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
          fullName: `${album.parent.owner}/${ARTWORKS_REPOSITORY}/${albumPath(album.parent.slug)}`,
          htmlUrl: `https://github.com/${encodeURIComponent(album.parent.owner)}/${ARTWORKS_REPOSITORY}/tree/${encodeURIComponent(parentBranch)}/${albumPath(album.parent.slug)}`,
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

  async #getRepository(accessToken, owner, requestOptions = {}) {
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}`,
      accessToken,
      requestOptions
    );
    return data;
  }

  async #ensureRepository(accessToken, user) {
    let repository;
    try {
      repository = await this.#getRepository(accessToken, user.login, { stage: "repo_get" });
    } catch (error) {
      if (error.status === 403) throw appNotInstalled(error);
      if (error.status !== 404) throw error;
    }

    if (!repository) {
      try {
        const { data } = await this.#request("/user/repos", accessToken, {
          stage: "repo_create",
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
        if (error.status === 403 || error.status === 404) {
          throw librarySetupRequired(error);
        }
        if (error.status !== 422) throw error;
        try {
          repository = await this.#getRepository(accessToken, user.login, { stage: "repo_get" });
        } catch (repoError) {
          if (repoError.status === 403) throw appNotInstalled(repoError);
          if (repoError.status === 404) throw librarySetupRequired(repoError);
          throw repoError;
        }
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
      await this.#readFile(accessToken, user.login, rootPath, defaultBranch, {
        stage: "catalog_get",
      });
    } catch (error) {
      if (error.status === 403) throw appPermissionDenied(error);
      if (error.status !== 404) throw error;
      try {
        await this.#writeFile(
          accessToken,
          user.login,
          rootPath,
          JSON.stringify({ format: "gridcraft-artworks", schemaVersion: 1 }, null, 2),
          "chore: initialize GridCraft artwork library",
          defaultBranch,
          undefined,
          { stage: "catalog_put" }
        );
      } catch (writeError) {
        if (writeError.status === 403) throw appPermissionDenied(writeError);
        throw writeError;
      }
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
      const manifest = parseManifestFile(file, item.path);
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

  async #readFile(accessToken, owner, filePath, branch = "master", requestOptions = {}) {
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      accessToken,
      requestOptions
    );
    return data;
  }

  async #writeFile(accessToken, owner, filePath, content, message, branch = "master", sha, requestOptions = {}) {
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/contents/${encodedPath}`,
      accessToken,
      {
        ...requestOptions,
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
    const pagination = normalizePagination(page, perPage);
    const result = this.store.listAlbums(pagination);
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
      const suffixText = `-${suffix}`;
      const baseSlug = source.slug.slice(0, 100 - suffixText.length).replace(/-+$/g, "");
      forkSlug = `${baseSlug}${suffixText}`;
      suffix += 1;
    }

    const destinationRepo = await this.#ensureRepository(accessToken, user);
    const sourceRepo = await this.#getRepository(accessToken, source.owner);
    const branch = sourceRepo.default_branch || "master";
    this.store.setUserDefaultBranch(source.ownerId, branch);
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
    const defaultBranch = rootRepo.default_branch || "master";
    this.store.setUserDefaultBranch(album.ownerId, defaultBranch);
    const manifestPath = `${albumPath(album.slug)}/album.json`;
    const file = await this.#readFile(accessToken, owner, manifestPath, defaultBranch);
    const manifest = parseManifestFile(file, manifestPath);
    return {
      repo: {
        ...mapAlbumToApi({ ...album, defaultBranch }),
        ownerAvatar: rootRepo.owner?.avatar_url || null,
        permissions: rootRepo.permissions || {},
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
    const currentManifest = parseManifestFile(file, filePath);
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
      shortSha: typeof commit.sha === "string" ? commit.sha.slice(0, 7) : "",
      message: commit.commit?.message || "",
      author: commit.commit?.author?.name,
      authorLogin: commit.author?.login || commit.commit?.author?.name,
      authorAvatar: commit.author?.avatar_url || null,
      date: commit.commit?.author?.date,
      htmlUrl: commit.html_url,
    }));
  }

  async getTree(accessToken, owner, slug, branch = "master") {
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      accessToken
    );
    if (data.truncated) {
      const error = new Error("The artwork library tree is too large to safely enumerate.");
      error.status = 422;
      throw error;
    }
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
