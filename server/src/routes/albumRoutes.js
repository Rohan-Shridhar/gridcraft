import { Router } from "express";
import { albumController as defaultController } from "../controllers/albumController.js";
import { requireAuth } from "../middleware/auth.js";

export function createAlbumRoutes(controller = defaultController) {
  const router = Router();

  // All album actions require authenticated user
  router.use(requireAuth);

  // List albums
  router.get("/", controller.listAlbums);

  // Create album
  router.post("/", controller.createAlbum);

  // Album detail
  router.get("/:owner/:repo", controller.getAlbum);

  // Update album metadata
  router.patch("/:owner/:repo", controller.updateAlbum);

  // Delete album repository
  router.delete("/:owner/:repo", controller.deleteAlbum);

  // Commits
  router.get("/:owner/:repo/commits", controller.listCommits);

  // Tree
  router.get("/:owner/:repo/tree", controller.getTree);

  // Initialize existing repository as album
  router.post("/:owner/:repo/initialize", controller.initializeRepo);

  return router;
}

export default createAlbumRoutes();
