import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/env.js";
import { APP_NAME, APP_VERSION } from "./config/version.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { loadSession, requireAuth } from "./middleware/auth.js";
import authRoutes, { createAuthRoutes } from "./routes/authRoutes.js";
import { AuthController } from "./controllers/authController.js";
import albumRoutes, { createAlbumRoutes } from "./routes/albumRoutes.js";
import { AlbumController } from "./controllers/albumController.js";
import { ArtworkController } from "./controllers/artworkController.js";
import { StoryController } from "./controllers/storyController.js";
import { BranchController } from "./controllers/branchController.js";
import { IssueController } from "./controllers/issueController.js";
import { PullRequestController } from "./controllers/pullRequestController.js";
import { ForkController } from "./controllers/forkController.js";
import { forkController as defaultForkController } from "./controllers/forkController.js";
import { albumService as defaultAlbumService } from "./services/albumService.js";

export function createApp({
  authService,
  authController,
  artworkLibraryService = defaultAlbumService,
  albumService,
  albumController,
  artworkService,
  artworkController,
  storyService,
  storyController,
  branchService,
  branchController,
  issueService,
  issueController,
  pullService,
  pullController,
  forkService,
  forkController,
} = {}) {
  const app = express();

  let resolvedAuthRoutes = authRoutes;
  if (authController) {
    resolvedAuthRoutes = createAuthRoutes(authController);
  } else if (authService) {
    resolvedAuthRoutes = createAuthRoutes(new AuthController(authService, artworkLibraryService));
  }

  const extras = {
    artworkCtrl: artworkController || (artworkService ? new ArtworkController(artworkService) : undefined),
    storyCtrl: storyController || (storyService ? new StoryController(storyService) : undefined),
    branchCtrl: branchController || (branchService ? new BranchController(branchService) : undefined),
    issueCtrl: issueController || (issueService ? new IssueController(issueService) : undefined),
    pullCtrl: pullController || (pullService ? new PullRequestController(pullService) : undefined),
    forkCtrl: forkController || (forkService ? new ForkController(forkService) : undefined),
  };

  const hasExtras = Object.values(extras).some(Boolean);
  let resolvedAlbumRoutes = albumRoutes;
  if (albumController || albumService || hasExtras) {
    const ctrl = albumController || new AlbumController(albumService);
    resolvedAlbumRoutes = createAlbumRoutes(ctrl, extras);
  }

  const resolvedForkController = extras.forkCtrl || defaultForkController;

  const allowedOrigins = [
    config.frontendUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(loadSession);

  const healthCheck = (req, res) => {
    res.json({
      status: "ok",
      version: APP_VERSION,
      app: APP_NAME,
      githubApp: config.github.appName,
      timestamp: new Date().toISOString(),
    });
  };

  app.get("/health", healthCheck);
  app.get("/api/v1/health", healthCheck);

  app.use("/api/v1/auth", resolvedAuthRoutes);
  app.use("/api/v1/albums", resolvedAlbumRoutes);
  app.get("/api/v1/forks", requireAuth, resolvedForkController.listUserForks);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
