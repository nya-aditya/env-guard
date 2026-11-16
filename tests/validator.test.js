import { describe, it, expect } from "vitest";
import { resolveValueWithDefaults } from "../src/validator.js";
import { ERROR_CODES } from "../src/errors.js";

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

  it("applies functional default when variable is missing", () => {
    const res = resolveValueWithDefaults("PORT", undefined, {
      type: "number",
      default: () => 4000,
    });
    expect(res.valid).toBe(true);
    expect(res.value).toBe(4000);
  });

  it("throws/fails with MISSING_REQUIRED when required variable is missing", () => {
    const res = resolveValueWithDefaults("DATABASE_URL", undefined, {
      type: "string",
      required: true,
    });
    expect(res.valid).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(ERROR_CODES.MISSING_REQUIRED);
    expect(res.error.variable).toBe("DATABASE_URL");
    expect(res.error.message).toContain("DATABASE_URL is required but was not provided");
  });

  it("enforces required precedence over default when required is explicitly true and missing", () => {
    const res = resolveValueWithDefaults("API_KEY", undefined, {
      type: "string",
      required: true,
      default: "fallback-key",
    });
    expect(res.valid).toBe(false);
    expect(res.error.code).toBe(ERROR_CODES.MISSING_REQUIRED);
  });

  it("rejects empty string for required variable by default", () => {
    const res = resolveValueWithDefaults("DATABASE_URL", "   ", {
      type: "string",
      required: true,
    });
    expect(res.valid).toBe(false);
    expect(res.error.code).toBe(ERROR_CODES.MISSING_REQUIRED);
    expect(res.error.message).toContain("cannot be empty");
  });

  it("allows empty string if allowEmpty is true", () => {
    const res = resolveValueWithDefaults("OPTIONAL_NOTE", "", {
      type: "string",
      required: true,
      allowEmpty: true,
    });
    expect(res.valid).toBe(true);
    expect(res.value).toBe("");
  });

  it("masks received value in error if secret is true", () => {
    const res = resolveValueWithDefaults("SECRET_KEY", "   ", {
      type: "string",
      required: true,
      secret: true,
    });
    expect(res.valid).toBe(false);
    expect(res.error.received).toBe("[REDACTED]");
  });
});
