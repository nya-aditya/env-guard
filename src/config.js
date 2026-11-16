import { validateSchema } from "./validator.js";
import { ConfigurationError, ERROR_CODES } from "./errors.js";
import { parseEnvFile } from "./parser.js";
import path from "node:path";

export const SCHEMA_SYMBOL = Symbol.for("env-guard.schema");

/**
 * Loads environment files in priority order for the given profile.
 * Precedence:
 * 1. Base .env
 * 2. Profile-specific .env.<profile> (if profile specified or detected)
 * 3. System source / process.env (always takes top precedence over files)
 *
 * @param {object} options
 * @param {string} [options.profile]
 * @param {string} [options.envDir]
 * @param {Record<string, string>} [options.source]
 * @returns {Record<string, string>}
 */
export function loadEnvironmentSources(options = {}) {
  const envDir = options.envDir || process.cwd();
  const source = options.source || process.env;
  const loaded = {};

  // Detect profile from explicit option, source, or system env
  const profile =
    options.profile !== undefined
      ? options.profile
      : source.NODE_ENV || process.env.NODE_ENV;

  // 1. Base .env
  const baseEnvPath = path.join(envDir, ".env");
  const baseParsed = parseEnvFile(baseEnvPath);
  Object.assign(loaded, baseParsed);

  // 2. Profile .env.<profile> (e.g. .env.production, .env.development, .env.test)
  if (profile && typeof profile === "string" && profile.trim()) {
    const profilePath = path.join(envDir, `.env.${profile.trim()}`);
    const profileParsed = parseEnvFile(profilePath);
    Object.assign(loaded, profileParsed);
  }

  // 3. System process.env or provided source takes highest precedence
  for (const [key, val] of Object.entries(source)) {
    if (val !== undefined) {
      loaded[key] = val;
    }
  }

  return loaded;
}

/**
 * Defines, parses, and validates environment configuration based on a schema.
 *
 * @param {Record<string, object>} schema - Configuration schema specification.
 * @param {object} [options]
 * @param {boolean} [options.collectErrors=false] - If true, aggregates all errors instead of throwing immediately.
 * @param {string} [options.profile] - Environment profile to load (e.g. "production", "development", "test").
 * @param {string} [options.envDir] - Directory where .env files are located.
 * @param {Record<string, string>} [options.source] - Optional source map (defaults to process.env).
 * @param {boolean} [options.loadEnv=true] - Whether to parse .env and profile files.
 * @param {boolean} [options.freeze=true] - Whether to freeze the returned configuration object.
 * @returns {Record<string, any>} The validated and converted configuration object.
 */
export function defineConfig(schema, options = {}) {
  const {
    collectErrors = false,
    profile,
    envDir = process.cwd(),
    source = process.env,
    loadEnv = true,
    freeze = true,
  } = options;

  let rawEnv;
  if (loadEnv) {
    rawEnv = loadEnvironmentSources({ profile, envDir, source });
  } else {
    rawEnv = { ...source };
  }

  // If fail-fast mode (collectErrors: false), validate and throw immediately on first error
  if (!collectErrors) {
    const config = {};
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      throw new ConfigurationError("Schema must be a non-null object.", {
        code: ERROR_CODES.INVALID_SCHEMA,
      });
    }

    const res = validateSchema(schema, rawEnv);
    if (!res.valid && res.errors.length > 0) {
      // Throw the first error directly
      throw res.errors[0];
    }

    Object.assign(config, res.config);
    attachSchemaMetadata(config, schema);

    if (freeze) {
      Object.freeze(config);
    }
    return config;
  }

  // Collect errors mode: validate all fields and collect all issues
  const res = validateSchema(schema, rawEnv);
  if (!res.valid) {
    const errorCount = res.errors.length;
    const summaryMessage = `Configuration validation failed with ${errorCount} error${
      errorCount === 1 ? "" : "s"
    }:\n${res.errors.map((e, idx) => `  ${idx + 1}. [${e.code}] ${e.variable}: ${e.message}`).join("\n")}`;

    const aggregateError = new ConfigurationError(summaryMessage, {
      code: ERROR_CODES.CONFIGURATION_SUMMARY_ERROR,
      errors: res.errors,
    });
    throw aggregateError;
  }

  const config = { ...res.config };
  attachSchemaMetadata(config, schema);

  if (freeze) {
    Object.freeze(config);
  }
  return config;
}

/**
 * Attaches non-enumerable schema metadata to the configuration object.
 *
 * @param {object} config
 * @param {object} schema
 */
function attachSchemaMetadata(config, schema) {
  Object.defineProperty(config, SCHEMA_SYMBOL, {
    value: schema,
    enumerable: false,
    writable: false,
    configurable: false,
  });
}
