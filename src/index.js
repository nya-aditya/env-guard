/**
 * env-guard
 * Schema-based environment configuration and validation for Node.js
 */

export { defineConfig, SCHEMA_SYMBOL } from "./config.js";
export { maskConfig, safeView } from "./masking.js";
export { ConfigurationError, ERROR_CODES } from "./errors.js";
export { parseEnv, parseEnvFile } from "./parser.js";
export { validateField, validateSchema } from "./validator.js";
export { CONVERTERS } from "./converters.js";

export const VERSION = "1.0.0";
