import { describe, it, expect } from "vitest";
import { defineConfig } from "../src/config.js";
import { ERROR_CODES, ConfigurationError } from "../src/errors.js";

describe("defineConfig - Fail-Fast vs Collect Errors mode", () => {
  const schema = {
    PORT: { type: "number", required: true },
    NODE_ENV: {
      type: "string",
      required: true,
      enum: ["development", "production", "test"],
    },
    API_URL: { type: "url", required: true },
  };

  describe("fail-fast mode (default)", () => {
    it("throws the very first error encountered directly", () => {
      expect(() => {
        defineConfig(schema, {
          source: {
            PORT: "not-a-number", // error 1
            NODE_ENV: "invalid-env", // error 2
            // API_URL missing -> error 3
          },
          loadEnv: false,
        });
      }).toThrowError(ConfigurationError);

      try {
        defineConfig(schema, {
          source: {
            PORT: "not-a-number",
            NODE_ENV: "invalid-env",
          },
          loadEnv: false,
        });
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_NUMBER);
        expect(err.variable).toBe("PORT");
      }
    });

    it("returns frozen configuration on success", () => {
      const config = defineConfig(
        {
          PORT: { type: "number", default: 3000 },
        },
        { source: {}, loadEnv: false }
      );

      expect(config.PORT).toBe(3000);
      expect(Object.isFrozen(config)).toBe(true);
      expect(() => {
        config.PORT = 4000;
      }).toThrow();
    });
  });

  describe("collect errors mode", () => {
    it("gathers all validation errors into a single summary ConfigurationError", () => {
      try {
        defineConfig(schema, {
          collectErrors: true,
          source: {
            PORT: "abc",
            NODE_ENV: "staging",
            API_URL: "invalid-url",
          },
          loadEnv: false,
        });
        expect.unreachable("Should have thrown ConfigurationError");
      } catch (err) {
        expect(err instanceof ConfigurationError).toBe(true);
        expect(err.code).toBe(ERROR_CODES.CONFIGURATION_SUMMARY_ERROR);
        expect(err.errors.length).toBe(3);

        const errorCodes = err.errors.map((e) => e.code);
        expect(errorCodes).toContain(ERROR_CODES.INVALID_NUMBER);
        expect(errorCodes).toContain(ERROR_CODES.INVALID_ENUM);
        expect(errorCodes).toContain(ERROR_CODES.INVALID_URL);

        const vars = err.errors.map((e) => e.variable);
        expect(vars).toEqual(["PORT", "NODE_ENV", "API_URL"]);
      }
    });

    it("succeeds when all values are valid in collectErrors mode", () => {
      const config = defineConfig(schema, {
        collectErrors: true,
        source: {
          PORT: "8080",
          NODE_ENV: "production",
          API_URL: "https://example.com",
        },
        loadEnv: false,
      });

      expect(config.PORT).toBe(8080);
      expect(config.NODE_ENV).toBe("production");
      expect(config.API_URL).toBe("https://example.com/");
    });
  });
});
