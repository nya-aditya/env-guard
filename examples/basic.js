import { defineConfig } from "../src/index.js";

// Basic configuration with sensible defaults and type conversion
const config = defineConfig(
  {
    PORT: {
      type: "number",
      default: 3000,
    },
    NODE_ENV: {
      type: "string",
      default: "development",
    },
    DEBUG: {
      type: "boolean",
      default: false,
    },
  },
  {
    // For demonstration, provide inline fallback source
    source: {
      PORT: "8080",
      DEBUG: "true",
    },
    loadEnv: false,
  }
);

console.log("=== Basic Configuration ===");
console.log(`Port: ${config.PORT} (type: ${typeof config.PORT})`);
console.log(`Node Environment: ${config.NODE_ENV}`);
console.log(`Debug Mode: ${config.DEBUG} (type: ${typeof config.DEBUG})`);
console.log(`Is Frozen: ${Object.isFrozen(config)}`);
