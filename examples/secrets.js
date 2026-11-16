import { defineConfig, safeView, maskConfig } from "../src/index.js";

const config = defineConfig(
  {
    PORT: {
      type: "number",
      default: 3000,
    },
    DATABASE_URL: {
      type: "string",
      required: true,
      secret: true,
    },
    API_KEY: {
      type: "string",
      required: true,
      secret: true,
    },
  },
  {
    source: {
      PORT: "5432",
      DATABASE_URL: "postgres://db_user:my_secret_password@db.internal:5432/finance",
      API_KEY: "prod_live_key_998877665544332211",
    },
    loadEnv: false,
  }
);

console.log("=== Safe Masking Demonstration ===");
console.log("1. Raw application runtime access (for authorized database client):");
console.log(`   Host from URL: ${new URL(config.DATABASE_URL).hostname}`);

console.log("\n2. Sanitized view for logging / diagnostics (safeView):");
console.log(safeView(config));

console.log("\n3. Custom mask representation (maskConfig):");
console.log(
  maskConfig(config, undefined, {
    mask: (key, val) => `[PROTECTED ${key}: len ${val.length}]`,
  })
);
