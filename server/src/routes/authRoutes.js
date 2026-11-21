import { Router } from "express";
import { authController as defaultAuthController, AuthController } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

export function createAuthRoutes(controller = defaultAuthController) {
  const router = Router();
  const preventCaching = (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  };

  // OAuth initiation
  router.get("/github", preventCaching, controller.startGitHubAuth);

  // OAuth callback
  router.get("/github/callback", preventCaching, controller.handleGitHubCallback);

  // Current user profile
  router.get("/me", controller.getCurrentUser);

  // Sign out
  router.post("/logout", controller.logout);

  // Disconnect / revoke
  router.post("/disconnect", requireAuth, controller.disconnect);

  return router;
}

export default createAuthRoutes();
