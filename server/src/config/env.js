import path from "node:path";
import dotenv from "dotenv";

// Load environment variables from project root .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: (process.env.NODE_ENV || "development") === "production",
  port: parseInt(process.env.PORT || "4000", 10),
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, ""),
  backendUrl: (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, ""),
  database: {
    path: process.env.GRIDCRAFT_DATABASE_PATH || path.resolve(process.cwd(), "server", "data", "gridcraft.sqlite"),
  },

  github: {
    appId: process.env.GITHUB_APP_ID || "",
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    privateKey: process.env.GITHUB_PRIVATE_KEY || "",
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
    appName: "gridcraft-auth",
  },

  session: {
    secret: process.env.SESSION_SECRET || "gridcraft-session-dev-secret-replace-in-prod-32ch",
    encryptionKey: process.env.TOKEN_ENCRYPTION_KEY || "gridcraft-token-key-dev-secret-32-chars",
    cookieName: "gc_session",
    stateCookieName: "gc_oauth_state",
    maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    stateMaxAgeMs: 10 * 60 * 1000, // 10 minutes
  },
};
