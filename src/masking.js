import { SCHEMA_SYMBOL } from "./config.js";

const DEFAULT_MASK = "********";

/**
 * Creates a safe, sanitized copy of the configuration object with secret fields masked.
 *
 * @param {Record<string, any>} config - The configuration object to mask.
 * @param {Record<string, object>} [schema] - Schema definition. Defaults to attached schema metadata.
 * @param {object} [options]
 * @param {string | ((key: string, val: any) => string)} [options.mask] - Custom mask string or masking function.
 * @returns {Record<string, any>} Sanitized configuration object safe for logging.
 */
export function maskConfig(config, schema, options = {}) {
  if (!config || typeof config !== "object") {
    return config;
  }

  const effectiveSchema = schema || config[SCHEMA_SYMBOL] || {};
  const maskValue = options.mask || DEFAULT_MASK;
  const result = {};

  for (const [key, val] of Object.entries(config)) {
    const rule = effectiveSchema[key];
    const isSecret = Boolean(rule && rule.secret);

    if (isSecret && val !== undefined && val !== null) {
      if (typeof maskValue === "function") {
        result[key] = maskValue(key, val);
      } else {
        result[key] = maskValue;
      }
    } else if (val && typeof val === "object" && !Array.isArray(val) && !isSecret) {
      // Shallow/deep copy non-secret objects
      result[key] = { ...val };
    } else {
      result[key] = val;
    }
  }

  return result;
}

/**
 * Convenient alias for maskConfig(config).
 * Automatically reads the schema metadata attached during defineConfig.
 *
 * @param {Record<string, any>} config
 * @param {object} [options]
 * @returns {Record<string, any>}
 */
export function safeView(config, options = {}) {
  return maskConfig(config, undefined, options);
}
