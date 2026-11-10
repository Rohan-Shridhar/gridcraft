import { createApp } from "./app.js";
import { config } from "./config/env.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`[GridCraft Server v3.4.0] Running on ${config.backendUrl}`);
  console.log(`[GridCraft Server v3.4.0] Connected GitHub App: ${config.github.appName}`);
  console.log(`[GridCraft Server v3.4.0] Frontend URL: ${config.frontendUrl}`);
});
