import { describe, it, expect } from "vitest";
import { maskConfig, safeView } from "../src/masking.js";
import { defineConfig } from "../src/config.js";

describe("Secret masking", () => {
  it("masks fields marked with secret: true using maskConfig(config, schema)", () => {
    const schema = {
      PORT: { type: "number", default: 3000 },
      NODE_ENV: { type: "string" },
      DATABASE_URL: { type: "string", secret: true },
      JWT_SECRET: { type: "string", secret: true },
    };

    const config = {
      PORT: 3000,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://user:password@localhost:5432/mydb",
      JWT_SECRET: "super-secret-token",
    };

    const safe = maskConfig(config, schema);

    expect(safe.PORT).toBe(3000);
    expect(safe.NODE_ENV).toBe("production");
    expect(safe.DATABASE_URL).toBe("********");
    expect(safe.JWT_SECRET).toBe("********");

    // Ensure raw credentials are never in the masked output
    const str = JSON.stringify(safe);
    expect(str).not.toContain("password");
    expect(str).not.toContain("super-secret-token");
  });

  it("supports safeView(config) with auto-detected schema metadata from defineConfig", () => {
    const config = defineConfig(
      {
        API_KEY: { type: "string", secret: true },
        APP_NAME: { type: "string", default: "my-service" },
      },
      {
        source: {
          API_KEY: "secret-key-xyz-987",
        },
        loadEnv: false,
      }
    );

    const safe = safeView(config);
    expect(safe.APP_NAME).toBe("my-service");
    expect(safe.API_KEY).toBe("********");
    expect(JSON.stringify(safe)).not.toContain("secret-key-xyz-987");
  });

  it("supports custom mask replacement string", () => {
    const schema = {
      SECRET: { type: "string", secret: true },
    };
    const config = { SECRET: "confidential" };

    const safe = maskConfig(config, schema, { mask: "[HIDDEN]" });
    expect(safe.SECRET).toBe("[HIDDEN]");
  });

  it("supports custom mask function", () => {
    const schema = {
      SECRET: { type: "string", secret: true },
    };
    const config = { SECRET: "long-sensitive-password" };

    const safe = maskConfig(config, schema, {
      mask: (key, val) => `(masked ${key} of len ${val.length})`,
    });
    expect(safe.SECRET).toBe("(masked SECRET of len 23)");
  });

  it("handles non-object configs gracefully", () => {
    expect(maskConfig(null)).toBeNull();
    expect(maskConfig(undefined)).toBeUndefined();
    expect(maskConfig("string")).toBe("string");
  });
});
