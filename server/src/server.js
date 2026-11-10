import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { APP_VERSION } from "./config/version.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`[GridCraft Server v${APP_VERSION}] Running on ${config.backendUrl}`);
  console.log(`[GridCraft Server v${APP_VERSION}] Connected GitHub App: ${config.github.appName}`);
  console.log(`[GridCraft Server v${APP_VERSION}] Frontend URL: ${config.frontendUrl}`);
});
