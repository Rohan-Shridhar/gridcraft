import { albumService, ARTWORKS_REPOSITORY } from "./albumService.js";

function mapFork(album) {
  return {
    id: album.id,
    name: album.slug,
    slug: album.slug,
    fullName: `${album.owner}/${ARTWORKS_REPOSITORY}/${album.slug}`,
    owner: album.owner,
    ownerAvatar: album.ownerAvatar,
    description: album.description,
    isPrivate: false,
    defaultBranch: album.defaultBranch || "master",
    htmlUrl: `https://github.com/${album.owner}/${ARTWORKS_REPOSITORY}/tree/${encodeURIComponent(album.defaultBranch || "master")}/${album.slug}`,
    fork: Boolean(album.parent),
    parent: album.parent
      ? {
          owner: album.parent.owner,
          name: album.parent.slug,
          slug: album.parent.slug,
          fullName: `${album.parent.owner}/${ARTWORKS_REPOSITORY}/${album.parent.slug}`,
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
    const forks = this.albums.store.listUserAlbums(user.id).filter((album) => album.parent);
    const start = (page - 1) * perPage;
    return {
      forks: forks.slice(start, start + perPage).map(mapFork),
      page,
      perPage,
      total: forks.length,
    };
  }
}

export const forkService = new ForkService();
