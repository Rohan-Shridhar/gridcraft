import { Router } from "express";
import { branchController as defaultController } from "../controllers/branchController.js";
import { requireAuth } from "../middleware/auth.js";

export function createBranchRoutes(controller = defaultController) {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);
  router.get("/", controller.listBranches);
  router.post("/", controller.createBranch);
  router.get("/compare", controller.compare);
  router.get("/:branch", controller.getBranch);
  router.patch("/:branch", controller.renameBranch);
  router.delete("/:branch", controller.deleteBranch);
  return router;
}

export default createBranchRoutes();
