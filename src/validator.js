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

  // Validate enum if specified
  if (Array.isArray(rule.enum)) {
    if (!rule.enum.includes(conversionResult.value)) {
      return {
        valid: false,
        error: new ConfigurationError(
          `Invalid value for ${key}. Expected one of: ${rule.enum
            .map((v) => JSON.stringify(v))
            .join(", ")}, received: ${
            isSecret ? "[REDACTED]" : JSON.stringify(conversionResult.value)
          }`,
          {
            code: ERROR_CODES.INVALID_ENUM,
            variable: key,
            expected: rule.enum,
            received: conversionResult.value,
            secret: isSecret,
          }
        ),
      };
    }
  }

  // Validate range for numbers
  if (type === "number") {
    const num = conversionResult.value;
    if (rule.min !== undefined && num < rule.min) {
      return {
        valid: false,
        error: new ConfigurationError(
          `Value for ${key} (${num}) is less than minimum allowed (${rule.min}).`,
          {
            code: ERROR_CODES.OUT_OF_RANGE,
            variable: key,
            expected: `>= ${rule.min}`,
            received: num,
            secret: isSecret,
          }
        ),
      };
    }

    if (rule.max !== undefined && num > rule.max) {
      return {
        valid: false,
        error: new ConfigurationError(
          `Value for ${key} (${num}) exceeds maximum allowed (${rule.max}).`,
          {
            code: ERROR_CODES.OUT_OF_RANGE,
            variable: key,
            expected: `<= ${rule.max}`,
            received: num,
            secret: isSecret,
          }
        ),
      };
    }
  }

  // Validate string length and pattern for strings
  if (typeof conversionResult.value === "string") {
    const str = conversionResult.value;

    if (rule.minLength !== undefined && str.length < rule.minLength) {
      return {
        valid: false,
        error: new ConfigurationError(
          `String length for ${key} (${str.length}) is shorter than minLength (${rule.minLength}).`,
          {
            code: ERROR_CODES.INVALID_LENGTH,
            variable: key,
            expected: `Length >= ${rule.minLength}`,
            received: str.length,
            secret: isSecret,
          }
        ),
      };
    }

    if (rule.maxLength !== undefined && str.length > rule.maxLength) {
      return {
        valid: false,
        error: new ConfigurationError(
          `String length for ${key} (${str.length}) exceeds maxLength (${rule.maxLength}).`,
          {
            code: ERROR_CODES.INVALID_LENGTH,
            variable: key,
            expected: `Length <= ${rule.maxLength}`,
            received: str.length,
            secret: isSecret,
          }
        ),
      };
    }

    if (rule.pattern) {
      const reg =
        rule.pattern instanceof RegExp
          ? rule.pattern
          : new RegExp(rule.pattern);

      if (!reg.test(str)) {
        return {
          valid: false,
          error: new ConfigurationError(
            `Value for ${key} does not match expected pattern ${reg.toString()}.`,
            {
              code: ERROR_CODES.INVALID_PATTERN,
              variable: key,
              expected: reg.toString(),
              received: isSecret ? "[REDACTED]" : str,
              secret: isSecret,
            }
          ),
        };
      }
    }
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

