import { describe, it, expect } from "vitest";
import { defineConfig, safeView, ERROR_CODES } from "../src/index.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Edge cases & Integration tests", () => {
  describe("PORT edge cases", () => {
    const portSchema = {
      PORT: {
        type: "number",
        required: true,
        min: 1,
        max: 65535,
      },
    };

    it("rejects empty PORT='' with MISSING_REQUIRED", () => {
      expect(() => {
        defineConfig(portSchema, { source: { PORT: "" }, loadEnv: false });
      }).toThrowError(/PORT is required and cannot be empty/);
    });

    it("rejects non-numeric PORT='abc' with INVALID_NUMBER", () => {
      try {
        defineConfig(portSchema, { source: { PORT: "abc" }, loadEnv: false });
        expect.unreachable();
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_NUMBER);
      }
    });

    it("rejects out-of-range PORT='0' with OUT_OF_RANGE", () => {
      try {
        defineConfig(portSchema, { source: { PORT: "0" }, loadEnv: false });
        expect.unreachable();
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.OUT_OF_RANGE);
      }
    });

    it("rejects negative PORT='-1' with OUT_OF_RANGE", () => {
      try {
        defineConfig(portSchema, { source: { PORT: "-1" }, loadEnv: false });
        expect.unreachable();
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.OUT_OF_RANGE);
      }
    });

    it("rejects out-of-range PORT='65536' with OUT_OF_RANGE", () => {
      try {
        defineConfig(portSchema, { source: { PORT: "65536" }, loadEnv: false });
        expect.unreachable();
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.OUT_OF_RANGE);
      }
    });

    it("accepts boundary values PORT='1' and PORT='65535'", () => {
      const c1 = defineConfig(portSchema, { source: { PORT: "1" }, loadEnv: false });
      expect(c1.PORT).toBe(1);

      const c2 = defineConfig(portSchema, { source: { PORT: "65535" }, loadEnv: false });
      expect(c2.PORT).toBe(65535);
    });
  });

  describe("DEBUG boolean edge cases", () => {
    const debugSchema = {
      DEBUG: { type: "boolean" },
    };

    it("handles true variations ('true', 'TRUE', 'True', '1', 'yes', 'on')", () => {
      for (const val of ["true", "TRUE", "True", "1", "yes", "on"]) {
        const c = defineConfig(debugSchema, { source: { DEBUG: val }, loadEnv: false });
        expect(c.DEBUG).toBe(true);
      }
    });

    it("handles false variations ('false', 'FALSE', 'False', '0', 'no', 'off')", () => {
      for (const val of ["false", "FALSE", "False", "0", "no", "off"]) {
        const c = defineConfig(debugSchema, { source: { DEBUG: val }, loadEnv: false });
        expect(c.DEBUG).toBe(false);
      }
    });

    it("rejects invalid booleans", () => {
      expect(() => {
        defineConfig(debugSchema, { source: { DEBUG: "maybe" }, loadEnv: false });
      }).toThrowError(/Expected boolean/);
    });
  });

  describe("URL and JSON edge cases", () => {
    it("rejects malformed URL with INVALID_URL", () => {
      try {
        defineConfig(
          { API_URL: { type: "url", required: true } },
          { source: { API_URL: "hello" }, loadEnv: false }
        );
        expect.unreachable();
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_URL);
      }
    });

    it("rejects malformed JSON with INVALID_JSON", () => {
      try {
        defineConfig(
          { CONFIG: { type: "json", required: true } },
          { source: { CONFIG: "{broken" }, loadEnv: false }
        );
        expect.unreachable();
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_JSON);
      }
    });

    it("accepts valid JSON arrays and objects", () => {
      const c = defineConfig(
        {
          FEATURES: { type: "json" },
          TAGS: { type: "json" },
        },
        {
          source: {
            FEATURES: '{"darkMode": true, "beta": false}',
            TAGS: '["web", "api"]',
          },
          loadEnv: false,
        }
      );
      expect(c.FEATURES).toEqual({ darkMode: true, beta: false });
      expect(c.TAGS).toEqual(["web", "api"]);
    });
  });

  describe("Special character secret masking", () => {
    it("masks secrets containing special characters properly without leaking in safeView or errors", () => {
      const specialPassword = "p@$$w0rd!#%^&*()_+{}[]:;\"'<>?,./~`\\";
      const config = defineConfig(
        {
          DB_PASSWORD: { type: "string", required: true, secret: true },
          APP_NAME: { type: "string", default: "SecureApp" },
        },
        {
          source: { DB_PASSWORD: specialPassword },
          loadEnv: false,
        }
      );

      // Raw config has actual value
      expect(config.DB_PASSWORD).toBe(specialPassword);

      // Safe view masks it
      const safe = safeView(config);
      expect(safe.DB_PASSWORD).toBe("********");
      expect(safe.APP_NAME).toBe("SecureApp");
      expect(JSON.stringify(safe)).not.toContain(specialPassword);
    });
  });

  describe("End-to-End full application integration", () => {
    it("loads .env file, applies schema, validates types, enforces immutability, and supports masking", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-guard-e2e-"));

      try {
        fs.writeFileSync(
          path.join(tmpDir, ".env"),
          `
          # Server Configuration
          PORT=4000
          NODE_ENV=production
          DEBUG=false
          API_URL=https://api.mycompany.com/v1
          DATABASE_URL=postgres://user:super_secret@db.host.com:5432/main_db
          RATELIMIT_MAX=500
          FEATURES={"analytics":true}
          `
        );

        const config = defineConfig(
          {
            PORT: { type: "number", min: 1024, max: 65535 },
            NODE_ENV: {
              type: "string",
              required: true,
              enum: ["development", "production", "test"],
            },
            DEBUG: { type: "boolean", default: true },
            API_URL: { type: "url", required: true },
            DATABASE_URL: { type: "string", required: true, secret: true },
            RATELIMIT_MAX: { type: "number", default: 100 },
            FEATURES: { type: "json" },
          },
          {
            envDir: tmpDir,
            loadEnv: true,
            source: {},
          }
        );

        // Verification of parsing and conversion
        expect(config.PORT).toBe(4000);
        expect(config.NODE_ENV).toBe("production");
        expect(config.DEBUG).toBe(false);
        expect(config.API_URL).toBe("https://api.mycompany.com/v1");
        expect(config.DATABASE_URL).toBe(
          "postgres://user:super_secret@db.host.com:5432/main_db"
        );
        expect(config.RATELIMIT_MAX).toBe(500);
        expect(config.FEATURES).toEqual({ analytics: true });

        // Immutability check
        expect(Object.isFrozen(config)).toBe(true);
        expect(() => {
          config.PORT = 8080;
        }).toThrow();

        // Safe masked view
        const safe = safeView(config);
        expect(safe.DATABASE_URL).toBe("********");
        expect(safe.PORT).toBe(4000);
        expect(JSON.stringify(safe)).not.toContain("super_secret");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
