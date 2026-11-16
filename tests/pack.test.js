import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("npm pack and external consumption", () => {
  it("packs cleanly and installs into a consumer project without errors", () => {
    const rootDir = process.cwd();
    const packOutput = execSync("npm pack --json", { cwd: rootDir, encoding: "utf8" });
    const [packMeta] = JSON.parse(packOutput);

    const tarballName = packMeta.filename;
    const tarballPath = path.resolve(rootDir, tarballName);

    expect(fs.existsSync(tarballPath)).toBe(true);

    const consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-guard-pack-test-"));

    try {
      fs.writeFileSync(
        path.join(consumerDir, "package.json"),
        JSON.stringify({
          name: "test-consumer",
          type: "module",
          dependencies: {},
        })
      );

      execSync(`npm install "${tarballPath}"`, {
        cwd: consumerDir,
        stdio: "pipe",
      });

      const verificationScript = `
        import { defineConfig, safeView } from "env-guard";
        import assert from "node:assert";

        const config = defineConfig({
          PORT: { type: "number", default: 8080 },
          SECRET_TOKEN: { type: "string", required: true, secret: true }
        }, {
          source: { SECRET_TOKEN: "abc-123-xyz" },
          loadEnv: false
        });

        assert.strictEqual(config.PORT, 8080);
        assert.strictEqual(safeView(config).SECRET_TOKEN, "********");
      `;

      fs.writeFileSync(path.join(consumerDir, "verify.js"), verificationScript);

      const runOutput = execSync("node verify.js", {
        cwd: consumerDir,
        encoding: "utf8",
      });

      expect(runOutput).toBe("");
    } finally {
      // Clean up tarball and test directory
      if (fs.existsSync(tarballPath)) {
        fs.unlinkSync(tarballPath);
      }
      fs.rmSync(consumerDir, { recursive: true, force: true });
    }
  });
});
