import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/env.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { loadSession } from "./middleware/auth.js";
import authRoutes, { createAuthRoutes } from "./routes/authRoutes.js";
import { AuthController } from "./controllers/authController.js";
import albumRoutes, { createAlbumRoutes } from "./routes/albumRoutes.js";
import { AlbumController } from "./controllers/albumController.js";

export function createApp({
  authService,
  authController,
  albumService,
  albumController,
} = {}) {
  const app = express();

  let resolvedAuthRoutes = authRoutes;
  if (authController) {
    resolvedAuthRoutes = createAuthRoutes(authController);
  } else if (authService) {
    resolvedAuthRoutes = createAuthRoutes(new AuthController(authService));
  }

  let resolvedAlbumRoutes = albumRoutes;
  if (albumController) {
    resolvedAlbumRoutes = createAlbumRoutes(albumController);
  } else if (albumService) {
    resolvedAlbumRoutes = createAlbumRoutes(new AlbumController(albumService));
  }

  // Cross-Origin Resource Sharing
  const allowedOrigins = [
    config.frontendUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Attach session user to req if session cookie exists
  app.use(loadSession);

  // Health check routes
  const healthCheck = (req, res) => {
    res.json({
      status: "ok",
      version: "3.4.0",
      app: "GridCraft",
      githubApp: config.github.appName,
      timestamp: new Date().toISOString(),
    });
  };

  app.get("/health", healthCheck);
  app.get("/api/v1/health", healthCheck);

  // Mount API v1 routes
  app.use("/api/v1/auth", resolvedAuthRoutes);
  app.use("/api/v1/albums", resolvedAlbumRoutes);

  // Fallthrough 404 handler
  app.use(notFoundHandler);

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}

export default createApp;
