import { defineConfig, ConfigurationError } from "../src/index.js";

const schema = {
  PORT: {
    type: "number",
    required: true,
    min: 1024,
    max: 65535,
    validate: (val) => {
      if (val === 5000) return "Port 5000 is reserved for internal diagnostics";
      return true;
    },
  },
  NODE_ENV: {
    type: "string",
    required: true,
    enum: ["development", "production", "test"],
  },
  API_URL: {
    type: "url",
    required: true,
  },
  SERVICE_NAME: {
    type: "string",
    pattern: /^svc-[a-z0-9-]+$/,
  },
};

console.log("=== 1. Valid Configuration Example ===");
const validConfig = defineConfig(schema, {
  source: {
    PORT: "3000",
    NODE_ENV: "production",
    API_URL: "https://api.example.com",
    SERVICE_NAME: "svc-payments-v1",
  },
  loadEnv: false,
});
console.log("Configuration valid!", validConfig);

console.log("\n=== 2. Collected Validation Errors Example ===");
try {
  defineConfig(schema, {
    collectErrors: true,
    source: {
      PORT: "500", // below min 1024
      NODE_ENV: "staging", // invalid enum
      API_URL: "not-a-url", // invalid URL
      SERVICE_NAME: "INVALID_NAME!", // pattern mismatch
    },
    loadEnv: false,
  });
} catch (err) {
  if (err instanceof ConfigurationError) {
    console.log("Caught ConfigurationError in collectErrors mode:");
    console.log(err.toDetailedString());
  }
}
