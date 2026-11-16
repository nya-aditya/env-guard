// CommonJS entrypoint for env-guard
const fs = require("node:fs");
const path = require("node:path");

const ERROR_CODES = {
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

class ConfigurationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ConfigurationError";
    this.code = options.code || ERROR_CODES.INVALID_TYPE;
    this.variable = options.variable || null;
    this.expected = options.expected !== undefined ? options.expected : null;

    if (options.secret) {
      this.received = "[REDACTED]";
    } else {
      this.received = options.received !== undefined ? options.received : null;
    }

    if (Array.isArray(options.errors)) {
      this.errors = options.errors;
    } else {
      this.errors = [];
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationError);
    }
  }

  toDetailedString() {
    if (this.errors && this.errors.length > 0) {
      const header = `ConfigurationError: ${this.errors.length} configuration problem${
        this.errors.length === 1 ? "" : "s"
      } detected:`;
      const lines = this.errors.map((err, idx) => {
        const varPrefix = err.variable ? ` [${err.variable}]` : "";
        const codePrefix = err.code ? ` (${err.code})` : "";
        return `  ${idx + 1}.${varPrefix}${codePrefix} ${err.message}`;
      });
      return [header, ...lines].join("\n");
    }
    const varPrefix = this.variable ? ` [${this.variable}]` : "";
    return `ConfigurationError${varPrefix} (${this.code}): ${this.message}`;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      variable: this.variable,
      expected: this.expected,
      received: this.received,
      errors: this.errors.map((e) => (typeof e.toJSON === "function" ? e.toJSON() : e)),
    };
  }
}

const TRUTHY_BOOLEANS = new Set(["true", "1", "yes", "t", "on"]);
const FALSY_BOOLEANS = new Set(["false", "0", "no", "f", "off"]);

function convertString(value) {
  if (value === undefined || value === null) {
    return { success: false, error: "Value is null or undefined" };
  }
  return { success: true, value: String(value) };
}

function convertNumber(value) {
  if (typeof value === "number") {
    if (Number.isFinite(value)) return { success: true, value };
    return { success: false, error: "Number must be finite" };
  }
  if (typeof value !== "string" || value.trim() === "") {
    return { success: false, error: "Expected valid numeric string" };
  }
  const num = Number(value.trim());
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { success: false, error: `Cannot convert "${value}" to number` };
  }
  return { success: true, value: num };
}

function convertBoolean(value) {
  if (typeof value === "boolean") return { success: true, value };
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TRUTHY_BOOLEANS.has(normalized)) return { success: true, value: true };
    if (FALSY_BOOLEANS.has(normalized)) return { success: true, value: false };
  }
  return {
    success: false,
    error: `Expected boolean (true/false, 1/0, yes/no), received "${value}"`,
  };
}

function convertUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { success: false, error: "Expected valid URL string" };
  }
  try {
    const parsed = new URL(value.trim());
    return { success: true, value: parsed.href };
  } catch {
    return { success: false, error: `Invalid URL format: "${value}"` };
  }
}

function convertJson(value) {
  if (typeof value === "object" && value !== null) return { success: true, value };
  if (typeof value !== "string" || !value.trim()) {
    return { success: false, error: "Expected valid JSON string" };
  }
  try {
    return { success: true, value: JSON.parse(value.trim()) };
  } catch (err) {
    return { success: false, error: `Invalid JSON: ${err.message}` };
  }
}

const CONVERTERS = {
  string: convertString,
  number: convertNumber,
  boolean: convertBoolean,
  url: convertUrl,
  json: convertJson,
};

function parseEnv(src) {
  const result = {};
  if (typeof src !== "string" || !src.trim()) return result;
  const lines = src.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();
    if (!line || line.startsWith("#")) {
      i++;
      continue;
    }
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      i++;
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    if (!key) {
      i++;
      continue;
    }
    let rawVal = line.slice(eqIndex + 1).trim();

    if (rawVal.startsWith('"') || rawVal.startsWith("'") || rawVal.startsWith("`")) {
      const quoteChar = rawVal[0];
      let valBuffer = rawVal.slice(1);
      let closed = false;
      let endQuoteIndex = -1;
      let escaped = false;
      for (let c = 0; c < valBuffer.length; c++) {
        const ch = valBuffer[c];
        if (quoteChar === '"' && ch === "\\" && !escaped) {
          escaped = true;
          continue;
        }
        if (ch === quoteChar && !escaped) {
          endQuoteIndex = c;
          closed = true;
          break;
        }
        escaped = false;
      }
      if (closed) {
        result[key] = unescapeQuoted(valBuffer.slice(0, endQuoteIndex), quoteChar);
      } else {
        const chunks = [valBuffer];
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          let endIdx = -1;
          let esc = false;
          for (let c = 0; c < nextLine.length; c++) {
            const ch = nextLine[c];
            if (quoteChar === '"' && ch === "\\" && !esc) {
              esc = true;
              continue;
            }
            if (ch === quoteChar && !esc) {
              endIdx = c;
              break;
            }
            esc = false;
          }
          if (endIdx !== -1) {
            chunks.push(nextLine.slice(0, endIdx));
            result[key] = unescapeQuoted(chunks.join("\n"), quoteChar);
            closed = true;
            break;
          } else {
            chunks.push(nextLine);
            i++;
          }
        }
        if (!closed) result[key] = chunks.join("\n");
      }
    } else {
      const commentIdx = rawVal.indexOf(" #");
      if (commentIdx !== -1) rawVal = rawVal.slice(0, commentIdx).trim();
      else if (rawVal.startsWith("#")) rawVal = "";
      result[key] = rawVal;
    }
    i++;
  }
  return result;
}

function unescapeQuoted(val, quoteChar) {
  if (quoteChar === '"') {
    return val
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  if (quoteChar === "'") return val.replace(/\\'/g, "'");
  return val;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return parseEnv(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

const SCHEMA_SYMBOL = Symbol.for("env-guard.schema");

function resolveValueWithDefaults(key, rawValue, rule = {}) {
  const isPresent = rawValue !== undefined && rawValue !== null;
  const isSecret = Boolean(rule.secret);

  if (!isPresent) {
    if (rule.required === true) {
      return {
        valid: false,
        error: new ConfigurationError(`${key} is required but was not provided.`, {
          code: ERROR_CODES.MISSING_REQUIRED,
          variable: key,
          expected: `Value of type "${rule.type || "string"}"`,
          received: undefined,
          secret: isSecret,
        }),
      };
    }
    if (rule.default !== undefined) {
      return {
        valid: true,
        value: typeof rule.default === "function" ? rule.default() : rule.default,
      };
    }
    return { valid: true, value: undefined };
  }

  if (typeof rawValue === "string" && rawValue.trim() === "") {
    if (rule.required === true && !rule.allowEmpty) {
      return {
        valid: false,
        error: new ConfigurationError(`${key} is required and cannot be empty.`, {
          code: ERROR_CODES.MISSING_REQUIRED,
          variable: key,
          expected: `Non-empty ${rule.type || "string"}`,
          received: '""',
          secret: isSecret,
        }),
      };
    }
    if (rule.useDefaultOnEmpty && rule.default !== undefined) {
      return {
        valid: true,
        value: typeof rule.default === "function" ? rule.default() : rule.default,
      };
    }
  }

  return { valid: true, value: rawValue };
}

function validateField(key, rawValue, rule = {}) {
  const isSecret = Boolean(rule.secret);
  const type = rule.type || "string";

  const resolved = resolveValueWithDefaults(key, rawValue, rule);
  if (!resolved.valid) return resolved;
  if (resolved.value === undefined) return { valid: true, value: undefined };

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
        rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
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

  if (typeof rule.validate === "function") {
    try {
      const customResult = rule.validate(conversionResult.value);
      if (customResult === false || typeof customResult === "string") {
        const errorMsg =
          typeof customResult === "string"
            ? customResult
            : `Custom validation failed for variable ${key}.`;
        return {
          valid: false,
          error: new ConfigurationError(errorMsg, {
            code: ERROR_CODES.CUSTOM_VALIDATION_FAILED,
            variable: key,
            expected: "Custom validation check to pass",
            received: isSecret ? "[REDACTED]" : conversionResult.value,
            secret: isSecret,
          }),
        };
      }
    } catch (err) {
      return {
        valid: false,
        error: new ConfigurationError(
          `Custom validator threw an exception for ${key}: ${err.message}`,
          {
            code: ERROR_CODES.CUSTOM_VALIDATION_FAILED,
            variable: key,
            expected: "Custom validation check to complete without error",
            received: isSecret ? "[REDACTED]" : conversionResult.value,
            secret: isSecret,
          }
        ),
      };
    }
  }

  return { valid: true, value: conversionResult.value };
}

function validateSchema(schema, rawEnv = {}) {
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
  return { valid: errors.length === 0, config, errors };
}

function loadEnvironmentSources(options = {}) {
  const envDir = options.envDir || process.cwd();
  const source = options.source || process.env;
  const loaded = {};
  const profile =
    options.profile !== undefined
      ? options.profile
      : source.NODE_ENV || process.env.NODE_ENV;

  const baseEnvPath = path.join(envDir, ".env");
  Object.assign(loaded, parseEnvFile(baseEnvPath));

  if (profile && typeof profile === "string" && profile.trim()) {
    const profilePath = path.join(envDir, `.env.${profile.trim()}`);
    Object.assign(loaded, parseEnvFile(profilePath));
  }

  for (const [key, val] of Object.entries(source)) {
    if (val !== undefined) loaded[key] = val;
  }
  return loaded;
}

function defineConfig(schema, options = {}) {
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

  if (!collectErrors) {
    const config = {};
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      throw new ConfigurationError("Schema must be a non-null object.", {
        code: ERROR_CODES.INVALID_SCHEMA,
      });
    }

    const res = validateSchema(schema, rawEnv);
    if (!res.valid && res.errors.length > 0) {
      throw res.errors[0];
    }
    Object.assign(config, res.config);
    attachSchemaMetadata(config, schema);
    if (freeze) Object.freeze(config);
    return config;
  }

  const res = validateSchema(schema, rawEnv);
  if (!res.valid) {
    const errorCount = res.errors.length;
    const summaryMessage = `Configuration validation failed with ${errorCount} error${
      errorCount === 1 ? "" : "s"
    }:\n${res.errors.map((e, idx) => `  ${idx + 1}. [${e.code}] ${e.variable}: ${e.message}`).join("\n")}`;

    throw new ConfigurationError(summaryMessage, {
      code: ERROR_CODES.CONFIGURATION_SUMMARY_ERROR,
      errors: res.errors,
    });
  }

  const config = { ...res.config };
  attachSchemaMetadata(config, schema);
  if (freeze) Object.freeze(config);
  return config;
}

function attachSchemaMetadata(config, schema) {
  Object.defineProperty(config, SCHEMA_SYMBOL, {
    value: schema,
    enumerable: false,
    writable: false,
    configurable: false,
  });
}

const DEFAULT_MASK = "********";

function maskConfig(config, schema, options = {}) {
  if (!config || typeof config !== "object") return config;
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
      result[key] = { ...val };
    } else {
      result[key] = val;
    }
  }
  return result;
}

function safeView(config, options = {}) {
  return maskConfig(config, undefined, options);
}

module.exports = {
  defineConfig,
  safeView,
  maskConfig,
  loadEnvironmentSources,
  ConfigurationError,
  ERROR_CODES,
  SCHEMA_SYMBOL,
  parseEnv,
  parseEnvFile,
  validateField,
  validateSchema,
  CONVERTERS,
  VERSION: "1.0.0",
};
