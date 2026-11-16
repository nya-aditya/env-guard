import { describe, it, expect } from "vitest";
import { ConfigurationError, ERROR_CODES } from "../src/errors.js";

describe("ConfigurationError", () => {
  it("extends standard Error", () => {
    const err = new ConfigurationError("Test error");
    expect(err instanceof Error).toBe(true);
    expect(err.name).toBe("ConfigurationError");
    expect(err.message).toBe("Test error");
  });

  it("stores error code, variable, expected, and received properties", () => {
    const err = new ConfigurationError("PORT must be positive", {
      code: ERROR_CODES.OUT_OF_RANGE,
      variable: "PORT",
      expected: ">= 1",
      received: -5,
    });

    expect(err.code).toBe(ERROR_CODES.OUT_OF_RANGE);
    expect(err.variable).toBe("PORT");
    expect(err.expected).toBe(">= 1");
    expect(err.received).toBe(-5);
  });

  it("redacts received value when secret option is true", () => {
    const err = new ConfigurationError("API_KEY is invalid", {
      code: ERROR_CODES.INVALID_PATTERN,
      variable: "API_KEY",
      expected: "valid format",
      received: "super-secret-password-1234",
      secret: true,
    });

    expect(err.received).toBe("[REDACTED]");
    expect(err.message).not.toContain("super-secret-password-1234");
  });

  it("formats single error using toDetailedString()", () => {
    const err = new ConfigurationError("PORT is required", {
      code: ERROR_CODES.MISSING_REQUIRED,
      variable: "PORT",
    });

    const str = err.toDetailedString();
    expect(str).toContain("[PORT]");
    expect(str).toContain("(MISSING_REQUIRED)");
    expect(str).toContain("PORT is required");
  });

  it("formats collected multiple errors using toDetailedString()", () => {
    const child1 = new ConfigurationError("PORT is required", {
      code: ERROR_CODES.MISSING_REQUIRED,
      variable: "PORT",
    });
    const child2 = new ConfigurationError("NODE_ENV is invalid", {
      code: ERROR_CODES.INVALID_ENUM,
      variable: "NODE_ENV",
    });

    const summary = new ConfigurationError("Configuration validation failed", {
      code: ERROR_CODES.CONFIGURATION_SUMMARY_ERROR,
      errors: [child1, child2],
    });

    const str = summary.toDetailedString();
    expect(str).toContain("2 configuration problems detected");
    expect(str).toContain("1. [PORT] (MISSING_REQUIRED) PORT is required");
    expect(str).toContain("2. [NODE_ENV] (INVALID_ENUM) NODE_ENV is invalid");
  });

  it("serializes to JSON cleanly", () => {
    const err = new ConfigurationError("DB_PASS invalid", {
      code: ERROR_CODES.INVALID_TYPE,
      variable: "DB_PASS",
      secret: true,
      received: "secret123",
    });

    const json = err.toJSON();
    expect(json.variable).toBe("DB_PASS");
    expect(json.received).toBe("[REDACTED]");
    expect(json.code).toBe(ERROR_CODES.INVALID_TYPE);
  });

  it("defines all expected error codes", () => {
    expect(ERROR_CODES).toHaveProperty("MISSING_REQUIRED");
    expect(ERROR_CODES).toHaveProperty("INVALID_TYPE");
    expect(ERROR_CODES).toHaveProperty("INVALID_NUMBER");
    expect(ERROR_CODES).toHaveProperty("INVALID_BOOLEAN");
    expect(ERROR_CODES).toHaveProperty("INVALID_URL");
    expect(ERROR_CODES).toHaveProperty("INVALID_JSON");
    expect(ERROR_CODES).toHaveProperty("INVALID_ENUM");
    expect(ERROR_CODES).toHaveProperty("OUT_OF_RANGE");
    expect(ERROR_CODES).toHaveProperty("INVALID_LENGTH");
    expect(ERROR_CODES).toHaveProperty("INVALID_PATTERN");
    expect(ERROR_CODES).toHaveProperty("CUSTOM_VALIDATION_FAILED");
    expect(ERROR_CODES).toHaveProperty("CONFIGURATION_SUMMARY_ERROR");
  });
});
