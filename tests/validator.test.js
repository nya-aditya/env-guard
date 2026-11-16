import { describe, it, expect } from "vitest";
import {
  resolveValueWithDefaults,
  validateField,
  validateSchema,
} from "../src/validator.js";
import { ERROR_CODES, ConfigurationError } from "../src/errors.js";

describe("resolveValueWithDefaults", () => {
  it("resolves provided values", () => {
    const res = resolveValueWithDefaults("PORT", "3000", { type: "number" });
    expect(res.valid).toBe(true);
    expect(res.value).toBe("3000");
  });

  it("applies default value when variable is missing", () => {
    const res = resolveValueWithDefaults("PORT", undefined, {
      type: "number",
      default: 3000,
    });
    expect(res.valid).toBe(true);
    expect(res.value).toBe(3000);
  });

  it("throws/fails with MISSING_REQUIRED when required variable is missing", () => {
    const res = resolveValueWithDefaults("DATABASE_URL", undefined, {
      type: "string",
      required: true,
    });
    expect(res.valid).toBe(false);
    expect(res.error.code).toBe(ERROR_CODES.MISSING_REQUIRED);
  });

  it("applies functional default when variable is missing", () => {
    const res = resolveValueWithDefaults("DYNAMIC_ID", undefined, {
      type: "string",
      default: () => "generated-id-123",
    });
    expect(res.valid).toBe(true);
    expect(res.value).toBe("generated-id-123");
  });

  it("applies default when value is empty and useDefaultOnEmpty is true", () => {
    const res = resolveValueWithDefaults("HOST", "", {
      type: "string",
      default: "127.0.0.1",
      useDefaultOnEmpty: true,
    });
    expect(res.valid).toBe(true);
    expect(res.value).toBe("127.0.0.1");
  });
});

describe("validateField", () => {
  it("converts valid string, number, boolean, url, json", () => {
    expect(validateField("PORT", "8080", { type: "number" })).toEqual({
      valid: true,
      value: 8080,
    });
    expect(validateField("DEBUG", "true", { type: "boolean" })).toEqual({
      valid: true,
      value: true,
    });
    expect(validateField("URL", "https://api.io", { type: "url" })).toEqual({
      valid: true,
      value: "https://api.io/",
    });
    expect(validateField("DATA", '{"ok":true}', { type: "json" })).toEqual({
      valid: true,
      value: { ok: true },
    });
  });

  it("handles unsupported schema types gracefully", () => {
    const res = validateField("UNKNOWN", "value", { type: "custom_unsupported" });
    expect(res.valid).toBe(false);
    expect(res.error.code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(res.error.message).toContain("Unsupported schema type");
  });

  it("returns appropriate conversion error codes", () => {
    const numRes = validateField("PORT", "abc", { type: "number" });
    expect(numRes.valid).toBe(false);
    expect(numRes.error.code).toBe(ERROR_CODES.INVALID_NUMBER);

    const boolRes = validateField("DEBUG", "invalid", { type: "boolean" });
    expect(boolRes.valid).toBe(false);
    expect(boolRes.error.code).toBe(ERROR_CODES.INVALID_BOOLEAN);

    const urlRes = validateField("API", "not-a-url", { type: "url" });
    expect(urlRes.valid).toBe(false);
    expect(urlRes.error.code).toBe(ERROR_CODES.INVALID_URL);

    const jsonRes = validateField("CONFIG", "{bad", { type: "json" });
    expect(jsonRes.valid).toBe(false);
    expect(jsonRes.error.code).toBe(ERROR_CODES.INVALID_JSON);
  });

  describe("enum validation", () => {
    const enumRule = {
      type: "string",
      enum: ["development", "production", "test"],
    };

    it("accepts values inside enum", () => {
      expect(validateField("NODE_ENV", "production", enumRule).valid).toBe(true);
      expect(validateField("NODE_ENV", "test", enumRule).valid).toBe(true);
    });

    it("rejects values not in enum with INVALID_ENUM", () => {
      const res = validateField("NODE_ENV", "staging123", enumRule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.INVALID_ENUM);
      expect(res.error.message).toContain("Expected one of");
      expect(res.error.received).toBe("staging123");
    });
  });

  describe("range validation", () => {
    const portRule = {
      type: "number",
      min: 1,
      max: 65535,
    };

    it("accepts numbers within range [min, max]", () => {
      expect(validateField("PORT", "3000", portRule).valid).toBe(true);
      expect(validateField("PORT", "1", portRule).valid).toBe(true);
      expect(validateField("PORT", "65535", portRule).valid).toBe(true);
    });

    it("rejects numbers below min with OUT_OF_RANGE", () => {
      const res = validateField("PORT", "0", portRule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.OUT_OF_RANGE);
      expect(res.error.message).toContain("less than minimum");
    });

    it("rejects numbers above max with OUT_OF_RANGE", () => {
      const res = validateField("PORT", "70000", portRule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.OUT_OF_RANGE);
      expect(res.error.message).toContain("exceeds maximum");
    });

    it("supports standalone min or max constraints", () => {
      expect(validateField("CONN", "5", { type: "number", min: 1 }).valid).toBe(true);
      expect(validateField("CONN", "-2", { type: "number", min: 1 }).valid).toBe(false);
      expect(validateField("CONN", "50", { type: "number", max: 100 }).valid).toBe(true);
      expect(validateField("CONN", "150", { type: "number", max: 100 }).valid).toBe(
        false
      );
    });
  });

  describe("string validation (minLength & maxLength)", () => {
    it("validates string minLength", () => {
      const rule = { type: "string", minLength: 10 };
      expect(validateField("KEY", "1234567890", rule).valid).toBe(true);
      const res = validateField("KEY", "short", rule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.INVALID_LENGTH);
      expect(res.error.message).toContain("shorter than minLength");
    });

    it("validates string maxLength", () => {
      const rule = { type: "string", maxLength: 5 };
      expect(validateField("NAME", "alice", rule).valid).toBe(true);
      const res = validateField("NAME", "toolongusername", rule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.INVALID_LENGTH);
      expect(res.error.message).toContain("exceeds maxLength");
    });
  });

  describe("pattern validation (regex)", () => {
    const patternRule = {
      type: "string",
      pattern: /^app-[a-z]+$/,
    };

    it("accepts matching patterns", () => {
      expect(validateField("APP_ENV", "app-prod", patternRule).valid).toBe(true);
    });

    it("rejects non-matching strings with INVALID_PATTERN", () => {
      const res = validateField("APP_ENV", "bad-format", patternRule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.INVALID_PATTERN);
      expect(res.error.message).toContain("does not match expected pattern");
      expect(res.error.received).toBe("bad-format");
    });

    it("does not leak secret values in pattern validation errors", () => {
      const res = validateField("SECRET_TOKEN", "invalid-token", {
        type: "string",
        pattern: /^secret-[0-9]+$/,
        secret: true,
      });
      expect(res.valid).toBe(false);
      expect(res.error.received).toBe("[REDACTED]");
    });
  });

  describe("custom validator support", () => {
    it("passes when custom validator returns true", () => {
      const rule = {
        type: "number",
        validate: (v) => v % 2 === 0,
      };
      expect(validateField("PORT", "3000", rule).valid).toBe(true);
    });

    it("fails with custom message when validator returns string", () => {
      const rule = {
        type: "number",
        validate: (v) => {
          if (v % 2 !== 0) return "PORT must be an even number";
          return true;
        },
      };
      const res = validateField("PORT", "3001", rule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.CUSTOM_VALIDATION_FAILED);
      expect(res.error.message).toBe("PORT must be an even number");
    });

    it("fails with default message when validator returns false", () => {
      const rule = {
        type: "number",
        validate: () => false,
      };
      const res = validateField("PORT", "3000", rule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.CUSTOM_VALIDATION_FAILED);
      expect(res.error.message).toContain("Custom validation failed for variable PORT");
    });

    it("handles thrown exceptions inside custom validator", () => {
      const rule = {
        type: "string",
        validate: () => {
          throw new Error("Validation subsystem offline");
        },
      };
      const res = validateField("VAR", "hello", rule);
      expect(res.valid).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.CUSTOM_VALIDATION_FAILED);
      expect(res.error.message).toContain("Validation subsystem offline");
    });
  });
});

describe("validateSchema", () => {
  it("rejects invalid schema input", () => {
    expect(() => validateSchema(null)).toThrow(ConfigurationError);
    expect(() => validateSchema("string")).toThrow(ConfigurationError);
  });

  it("validates multiple fields into clean config object", () => {
    const schema = {
      PORT: { type: "number", default: 3000 },
      NODE_ENV: { type: "string", default: "development" },
      DEBUG: { type: "boolean", default: false },
      URL: { type: "url", required: true },
    };

    const env = {
      PORT: "8080",
      URL: "https://example.com",
    };

    const result = validateSchema(schema, env);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.config).toEqual({
      PORT: 8080,
      NODE_ENV: "development",
      DEBUG: false,
      URL: "https://example.com/",
    });
  });

  it("accumulates errors across invalid fields", () => {
    const schema = {
      PORT: { type: "number" },
      API_KEY: { type: "string", required: true },
    };

    const env = {
      PORT: "not-a-number",
      // API_KEY missing
    };

    const result = validateSchema(schema, env);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_NUMBER);
    expect(result.errors[1].code).toBe(ERROR_CODES.MISSING_REQUIRED);
  });
});
