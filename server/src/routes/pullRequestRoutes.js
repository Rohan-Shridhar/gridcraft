import { Router } from "express";
import { pullRequestController as defaultController } from "../controllers/pullRequestController.js";
import { requireAuth } from "../middleware/auth.js";

export function createPullRequestRoutes(controller = defaultController) {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);
  router.get("/", controller.listPulls);
  router.post("/", controller.createPull);
  router.get("/:number", controller.getPull);
  router.patch("/:number", controller.updatePull);
  router.post("/:number/reviews", controller.submitReview);
  router.post("/:number/comments", controller.commentOnPull);
  router.put("/:number/merge", controller.mergePull);
  return router;
}

export default createPullRequestRoutes();
