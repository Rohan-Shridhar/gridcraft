import { albumService, ARTWORKS_REPOSITORY } from "./albumService.js";

function buildAlbumHtmlUrl(owner, slug, defaultBranch = "master") {
  return `https://github.com/${encodeURIComponent(owner)}/${ARTWORKS_REPOSITORY}/tree/${encodeURIComponent(defaultBranch || "master")}/${encodeURIComponent(slug)}`;
}

function mapFork(album) {
  const defaultBranch = album.defaultBranch || "master";
  const parentBranch = album.parent?.defaultBranch || "master";
  return {
    id: album.id,
    name: album.slug,
    slug: album.slug,
    fullName: `${album.owner}/${ARTWORKS_REPOSITORY}/${album.slug}`,
    owner: album.owner,
    ownerAvatar: album.ownerAvatar,
    description: album.description,
    isPrivate: false,
    defaultBranch,
    htmlUrl: buildAlbumHtmlUrl(album.owner, album.slug, defaultBranch),
    fork: Boolean(album.parent),
    parent: album.parent
      ? {
          owner: album.parent.owner,
          name: album.parent.slug,
          slug: album.parent.slug,
          fullName: `${album.parent.owner}/${ARTWORKS_REPOSITORY}/${album.parent.slug}`,
          defaultBranch: parentBranch,
          htmlUrl: buildAlbumHtmlUrl(album.parent.owner, album.parent.slug, parentBranch),
        }
      : null,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  };
}

export class ForkService {
  constructor(service = albumService) {
    this.albums = service;
  }

  async forkAlbum(accessToken, user, owner, slug) {
    return this.albums.forkAlbum(accessToken, user, owner, slug);
  }

  listUserForks(_accessToken, user, { page = 1, perPage = 30 } = {}) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safePerPage = Number.isInteger(perPage) && perPage > 0 ? Math.min(perPage, 100) : 30;
    const forks = this.albums.store.listUserAlbums(user.id).filter((album) => album.parent);
    const start = (safePage - 1) * safePerPage;
    return {
      forks: forks.slice(start, start + safePerPage).map(mapFork),
      page: safePage,
      perPage: safePerPage,
      total: forks.length,
    };
  }
}

export const forkService = new ForkService();
