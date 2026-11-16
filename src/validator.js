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
