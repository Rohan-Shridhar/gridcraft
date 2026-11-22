import path from "node:path";
import dotenv from "dotenv";

// Load environment variables from project root .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEV_SESSION_SECRET = "gridcraft-session-dev-secret-replace-in-prod-32ch";
const DEV_TOKEN_ENCRYPTION_KEY = "gridcraft-token-key-dev-secret-32-chars";

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction:
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production",
  port: parseInt(process.env.PORT || "4000", 10),
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, ""),
  backendUrl: (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, ""),
  database: {
    path:
      process.env.GRIDCRAFT_DATABASE_PATH ||
      (process.env.VERCEL ? "/tmp/gridcraft.sqlite" : path.resolve(process.cwd(), "server", "data", "gridcraft.sqlite")),
  },

  github: {
    appId: process.env.GITHUB_APP_ID || "",
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    privateKey: process.env.GITHUB_PRIVATE_KEY || "",
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
    appSlug: process.env.GITHUB_APP_SLUG || "gridcraft-auth",
    appName: "gridcraft-auth",
  },

  session: {
    secret: process.env.SESSION_SECRET || DEV_SESSION_SECRET,
    encryptionKey: process.env.TOKEN_ENCRYPTION_KEY || DEV_TOKEN_ENCRYPTION_KEY,
    cookieName: "gc_session",
    stateCookieName: "gc_oauth_state",
    maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    stateMaxAgeMs: 10 * 60 * 1000, // 10 minutes
  },
};

export function assertProductionSecrets(cfg) {
  if (!cfg.isProduction || cfg.nodeEnv === "test") return;

  const { secret, encryptionKey } = cfg.session || {};
  const invalid = (value, fallback) =>
    typeof value !== "string" ||
    value === fallback ||
    value.length < 32;

  if (
    invalid(secret, DEV_SESSION_SECRET) ||
    invalid(encryptionKey, DEV_TOKEN_ENCRYPTION_KEY) ||
    secret === encryptionKey
  ) {
    throw new Error(
      "Production requires distinct SESSION_SECRET and TOKEN_ENCRYPTION_KEY values of at least 32 characters."
    );
  }
}
