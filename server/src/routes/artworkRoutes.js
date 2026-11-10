import { Router } from "express";
import { artworkController as defaultController } from "../controllers/artworkController.js";
import { requireAuth } from "../middleware/auth.js";

export function createArtworkRoutes(controller = defaultController) {
  const router = Router({ mergeParams: true });

  router.use(requireAuth);

  // List artworks in album
  router.get("/", controller.listArtworks);

  // Create new artwork in album
  router.post("/", controller.createArtwork);

  // Get specific artwork
  router.get("/:artworkId", controller.getArtwork);

  // Update / save artwork with optimistic concurrency (SHA)
  router.put("/:artworkId", controller.saveArtwork);

  // Rename artwork metadata / path
  router.patch("/:artworkId", controller.renameArtwork);

  // Delete artwork
  router.delete("/:artworkId", controller.deleteArtwork);

  // Artwork commit history
  router.get("/:artworkId/commits", controller.getArtworkHistory);

  return router;
}

export default createArtworkRoutes();
