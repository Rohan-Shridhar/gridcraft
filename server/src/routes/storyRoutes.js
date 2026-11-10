import { Router } from "express";
import { storyController as defaultController } from "../controllers/storyController.js";
import { requireAuth } from "../middleware/auth.js";

export function createStoryRoutes(controller = defaultController) {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);
  router.get("/", controller.listStories);
  router.post("/", controller.createStory);
  router.get("/:storyId", controller.getStory);
  router.put("/:storyId", controller.saveStory);
  router.delete("/:storyId", controller.deleteStory);
  router.post("/:storyId/frames", controller.addFrame);
  router.patch("/:storyId/frames/order", controller.reorderFrames);
  return router;
}

export default createStoryRoutes();
