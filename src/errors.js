/**
 * Error codes emitted by env-guard.
 */
export const ERROR_CODES = {
  MISSING_REQUIRED: "MISSING_REQUIRED",
  INVALID_TYPE: "INVALID_TYPE",
  INVALID_NUMBER: "INVALID_NUMBER",
  INVALID_BOOLEAN: "INVALID_BOOLEAN",
  INVALID_URL: "INVALID_URL",
  INVALID_JSON: "INVALID_JSON",
  INVALID_ENUM: "INVALID_ENUM",
  OUT_OF_RANGE: "OUT_OF_RANGE",
  INVALID_LENGTH: "INVALID_LENGTH",
  INVALID_PATTERN: "INVALID_PATTERN",
  CUSTOM_VALIDATION_FAILED: "CUSTOM_VALIDATION_FAILED",
  CONFIGURATION_SUMMARY_ERROR: "CONFIGURATION_SUMMARY_ERROR",
  INVALID_SCHEMA: "INVALID_SCHEMA",
};

/**
 * Custom error class for configuration and validation failures.
 */
export class ConfigurationError extends Error {
  /**
   * @param {string} message - Human-readable explanation of the error.
   * @param {object} [options]
   * @param {string} [options.code] - One of ERROR_CODES.
   * @param {string} [options.variable] - Name of the environment variable.
   * @param {unknown} [options.expected] - Description or value of expected constraint.
   * @param {unknown} [options.received] - Description or non-secret received value.
   * @param {ConfigurationError[]} [options.errors] - Collected child errors if any.
   * @param {boolean} [options.secret] - Whether this variable is a secret (masks received value).
   */
  constructor(message, options = {}) {
    super(message);
    this.name = "ConfigurationError";
    this.code = options.code || ERROR_CODES.INVALID_TYPE;
    this.variable = options.variable || null;
    this.expected = options.expected !== undefined ? options.expected : null;

    // Never leak secrets in error.received or message
    if (options.secret) {
      this.received = "[REDACTED]";
    } else {
      this.received = options.received !== undefined ? options.received : null;
    }

    if (Array.isArray(options.errors)) {
      this.errors = options.errors;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationError);
    }
  }

  /**
   * Returns a clean, developer-friendly string representation of all errors.
   */
  toDetailedString() {
    if (this.errors && this.errors.length > 0) {
      const header = `ConfigurationError: ${this.errors.length} configuration problem${
        this.errors.length === 1 ? "" : "s"
      } detected:`;
      const lines = this.errors.map(
        (err, idx) => `  ${idx + 1}. [${err.code}] ${err.variable || "GLOBAL"}: ${err.message}`
      );
      return [header, ...lines].join("\n");
    }
    return `ConfigurationError [${this.code}] ${this.variable || ""}: ${this.message}`;
  }
}
