import { Router } from "express";
import { albumController as defaultController } from "../controllers/albumController.js";
import { artworkController as defaultArtworkController } from "../controllers/artworkController.js";
import { storyController as defaultStoryController } from "../controllers/storyController.js";
import { branchController as defaultBranchController } from "../controllers/branchController.js";
import { issueController as defaultIssueController } from "../controllers/issueController.js";
import { pullRequestController as defaultPullController } from "../controllers/pullRequestController.js";
import { forkController as defaultForkController } from "../controllers/forkController.js";
import { createArtworkRoutes } from "./artworkRoutes.js";
import { createStoryRoutes } from "./storyRoutes.js";
import { createBranchRoutes } from "./branchRoutes.js";
import { createIssueRoutes } from "./issueRoutes.js";
import { createPullRequestRoutes } from "./pullRequestRoutes.js";
import { requireAuth } from "../middleware/auth.js";

function normalizeExtras(artworkCtrlOrExtras) {
  if (!artworkCtrlOrExtras) return {};
  if (typeof artworkCtrlOrExtras.listArtworks === "function") {
    return { artworkCtrl: artworkCtrlOrExtras };
  }
  return artworkCtrlOrExtras;
}

export function createAlbumRoutes(
  controller = defaultController,
  artworkCtrlOrExtras = defaultArtworkController
) {
  const extras = normalizeExtras(artworkCtrlOrExtras);
  const artworkCtrl = extras.artworkCtrl || defaultArtworkController;
  const storyCtrl = extras.storyCtrl || defaultStoryController;
  const branchCtrl = extras.branchCtrl || defaultBranchController;
  const issueCtrl = extras.issueCtrl || defaultIssueController;
  const pullCtrl = extras.pullCtrl || defaultPullController;
  const forkCtrl = extras.forkCtrl || defaultForkController;

  const router = Router();
  router.use(requireAuth);

  router.use("/:owner/:repo/artworks", createArtworkRoutes(artworkCtrl));
  router.use("/:owner/:repo/stories", createStoryRoutes(storyCtrl));
  router.use("/:owner/:repo/branches", createBranchRoutes(branchCtrl));
  router.use("/:owner/:repo/issues", createIssueRoutes(issueCtrl));
  router.use("/:owner/:repo/pulls", createPullRequestRoutes(pullCtrl));
  router.get("/:owner/:repo/compare", branchCtrl.compare);
  router.post("/:owner/:repo/forks", forkCtrl.forkAlbum);

  router.get("/", controller.listAlbums);
  router.post("/", controller.createAlbum);
  router.get("/:owner/:repo", controller.getAlbum);
  router.patch("/:owner/:repo", controller.updateAlbum);
  router.delete("/:owner/:repo", controller.deleteAlbum);
  router.get("/:owner/:repo/commits", controller.listCommits);
  router.get("/:owner/:repo/tree", controller.getTree);
  router.post("/:owner/:repo/initialize", controller.initializeRepo);

  return router;
}

export default createAlbumRoutes();
