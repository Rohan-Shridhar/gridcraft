import { Router } from "express";
import { issueController as defaultController } from "../controllers/issueController.js";
import { requireAuth } from "../middleware/auth.js";

export function createIssueRoutes(controller = defaultController) {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);
  router.get("/", controller.listIssues);
  router.post("/", controller.createIssue);
  router.get("/:number", controller.getIssue);
  router.patch("/:number", controller.updateIssue);
  router.post("/:number/comments", controller.addComment);
  return router;
}

export default createIssueRoutes();
