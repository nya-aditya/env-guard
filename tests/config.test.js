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

    it("allows unfrozen configuration when freeze: false", () => {
      const config = defineConfig(
        {
          PORT: { type: "number", default: 3000 },
        },
        { source: {}, loadEnv: false, freeze: false }
      );

      expect(config.PORT).toBe(3000);
      expect(Object.isFrozen(config)).toBe(false);
      config.PORT = 5000;
      expect(config.PORT).toBe(5000);
    });

    it("throws ConfigurationError when schema is invalid", () => {
      expect(() => defineConfig(null)).toThrow(ConfigurationError);
      expect(() => defineConfig(undefined)).toThrow(ConfigurationError);
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

  describe("environment profiles and precedence", () => {
    it("follows precedence: .env -> .env.<profile> -> process.env / source", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const os = await import("node:os");

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-guard-profile-"));

      try {
        // Base .env
        fs.writeFileSync(
          path.join(tmpDir, ".env"),
          "PORT=3000\nDATABASE_URL=postgres://localhost/dev_db\nLOG_LEVEL=info\n"
        );

        // Production profile .env.production
        fs.writeFileSync(
          path.join(tmpDir, ".env.production"),
          "PORT=8000\nDATABASE_URL=postgres://prod-server/prod_db\n"
        );

        // Test with profile = 'production', and explicit source override for PORT
        const config = defineConfig(
          {
            PORT: { type: "number" },
            DATABASE_URL: { type: "string" },
            LOG_LEVEL: { type: "string" },
          },
          {
            profile: "production",
            envDir: tmpDir,
            loadEnv: true,
            source: {
              PORT: "9000", // System env overrides both .env and .env.production
            },
          }
        );

        // PORT was overridden by system source (9000)
        expect(config.PORT).toBe(9000);
        // DATABASE_URL was overridden by .env.production
        expect(config.DATABASE_URL).toBe("postgres://prod-server/prod_db");
        // LOG_LEVEL came from base .env
        expect(config.LOG_LEVEL).toBe("info");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("auto-detects profile from source.NODE_ENV when options.profile is not specified", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const os = await import("node:os");

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-guard-autoprofile-"));

      try {
        fs.writeFileSync(path.join(tmpDir, ".env"), "APP_ENV=local\n");
        fs.writeFileSync(path.join(tmpDir, ".env.test"), "APP_ENV=in-test\n");

        const config = defineConfig(
          {
            APP_ENV: { type: "string" },
          },
          {
            envDir: tmpDir,
            loadEnv: true,
            source: {
              NODE_ENV: "test",
            },
          }
        );

        expect(config.APP_ENV).toBe("in-test");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
