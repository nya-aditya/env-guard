import { ConfigurationError, ERROR_CODES } from "./errors.js";
import { CONVERTERS } from "./converters.js";

/**
 * Validates whether a variable is missing or empty when required.
 *
 * @param {string} key - Environment variable name.
 * @param {unknown} rawValue - Raw value from environment source.
 * @param {object} rule - Schema rule definition.
 * @returns {{ valid: boolean, value?: unknown, error?: ConfigurationError }}
 */
export function resolveValueWithDefaults(key, rawValue, rule = {}) {
  const isPresent = rawValue !== undefined && rawValue !== null;
  const isSecret = Boolean(rule.secret);

  // If missing from environment
  if (!isPresent) {
    if (rule.required === true) {
      return {
        valid: false,
        error: new ConfigurationError(
          `${key} is required but was not provided.`,
          {
            code: ERROR_CODES.MISSING_REQUIRED,
            variable: key,
            expected: `Value of type "${rule.type || "string"}"`,
            received: undefined,
            secret: isSecret,
          }
        ),
      };
    }

    if (rule.default !== undefined) {
      // Default value applied
      return {
        valid: true,
        value: typeof rule.default === "function" ? rule.default() : rule.default,
      };
    }

    return { valid: true, value: undefined };
  }

  // Value is present, check if required but empty string
  if (typeof rawValue === "string" && rawValue.trim() === "") {
    if (rule.required === true && !rule.allowEmpty) {
      return {
        valid: false,
        error: new ConfigurationError(
          `${key} is required and cannot be empty.`,
          {
            code: ERROR_CODES.MISSING_REQUIRED,
            variable: key,
            expected: `Non-empty ${rule.type || "string"}`,
            received: '""',
            secret: isSecret,
          }
        ),
      };
    }

    // If not required, but empty and default exists with useDefaultOnEmpty
    if (rule.useDefaultOnEmpty && rule.default !== undefined) {
      return {
        valid: true,
        value: typeof rule.default === "function" ? rule.default() : rule.default,
      };
    }
  }

  return { valid: true, value: rawValue };
}

/**
 * Validates a single field according to schema definition and converts its type.
 *
 * @param {string} key
 * @param {unknown} rawValue
 * @param {object} rule
 * @returns {{ valid: boolean, value?: unknown, error?: ConfigurationError }}
 */
export function validateField(key, rawValue, rule = {}) {
  const isSecret = Boolean(rule.secret);
  const type = rule.type || "string";

  // First resolve presence and defaults
  const resolved = resolveValueWithDefaults(key, rawValue, rule);
  if (!resolved.valid) {
    return resolved;
  }

  // If value is undefined and not required, we can safely return undefined
  if (resolved.value === undefined) {
    return { valid: true, value: undefined };
  }

  // Validate supported type
  const converter = CONVERTERS[type];
  if (!converter) {
    return {
      valid: false,
      error: new ConfigurationError(
        `Unsupported schema type "${type}" for variable ${key}. Supported types: ${Object.keys(
          CONVERTERS
        ).join(", ")}`,
        {
          code: ERROR_CODES.INVALID_TYPE,
          variable: key,
          expected: `One of: ${Object.keys(CONVERTERS).join(", ")}`,
          received: type,
        }
      ),
    };
  }

  // Convert value
  const conversionResult = converter(resolved.value);
  if (!conversionResult.success) {
    let errorCode = ERROR_CODES.INVALID_TYPE;
    if (type === "number") errorCode = ERROR_CODES.INVALID_NUMBER;
    else if (type === "boolean") errorCode = ERROR_CODES.INVALID_BOOLEAN;
    else if (type === "url") errorCode = ERROR_CODES.INVALID_URL;
    else if (type === "json") errorCode = ERROR_CODES.INVALID_JSON;

    return {
      valid: false,
      error: new ConfigurationError(
        `Failed to convert ${key} to ${type}: ${conversionResult.error}`,
        {
          code: errorCode,
          variable: key,
          expected: type,
          received: resolved.value,
          secret: isSecret,
        }
      ),
    };
  }

  return { valid: true, value: conversionResult.value };
}

/**
 * Validates a complete schema against raw environment variables.
 *
 * @param {Record<string, object>} schema
 * @param {Record<string, string>} rawEnv
 * @returns {{ valid: boolean, config: Record<string, any>, errors: ConfigurationError[] }}
 */
export function validateSchema(schema, rawEnv = {}) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new ConfigurationError("Schema must be a non-null object.", {
      code: ERROR_CODES.INVALID_SCHEMA,
    });
  }

  const config = {};
  const errors = [];

  for (const [key, rule] of Object.entries(schema)) {
    const rawVal = rawEnv[key];
    const fieldResult = validateField(key, rawVal, rule);

    if (!fieldResult.valid && fieldResult.error) {
      errors.push(fieldResult.error);
    } else if (fieldResult.value !== undefined) {
      config[key] = fieldResult.value;
    }
  }

  return {
    valid: errors.length === 0,
    config,
    errors,
  };
}

