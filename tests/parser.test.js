import { describe, it, expect } from "vitest";
import { parseEnv, parseEnvFile } from "../src/parser.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("parseEnv", () => {
  it("should return empty object for empty input", () => {
    expect(parseEnv("")).toEqual({});
    expect(parseEnv("   \n\n  ")).toEqual({});
    expect(parseEnv(null)).toEqual({});
  });

  it("should parse simple KEY=VALUE pairs", () => {
    const src = `
      PORT=3000
      HOST=localhost
      DEBUG=true
    `;
    expect(parseEnv(src)).toEqual({
      PORT: "3000",
      HOST: "localhost",
      DEBUG: "true",
    });
  });

  it("should ignore comments and empty lines", () => {
    const src = `
      # Server config
      PORT=3000

      # Database
      DB_HOST=127.0.0.1
    `;
    expect(parseEnv(src)).toEqual({
      PORT: "3000",
      DB_HOST: "127.0.0.1",
    });
  });

  it("should support export prefix", () => {
    const src = `
      export PORT=8080
      export APP_NAME=myapp
    `;
    expect(parseEnv(src)).toEqual({
      PORT: "8080",
      APP_NAME: "myapp",
    });
  });

  it("should parse single and double quoted values", () => {
    const src = `
      SINGLE='hello world'
      DOUBLE="hello \\"world\\""
      NEWLINE="first\\nsecond"
    `;
    expect(parseEnv(src)).toEqual({
      SINGLE: "hello world",
      DOUBLE: 'hello "world"',
      NEWLINE: "first\nsecond",
    });
  });

  it("should handle multiline quoted strings", () => {
    const src = `
      CERT="-----BEGIN CERT-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERT-----"
      NAME=test
    `;
    expect(parseEnv(src)).toEqual({
      CERT: "-----BEGIN CERT-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END CERT-----",
      NAME: "test",
    });
  });

  it("should strip inline comments for unquoted values", () => {
    const src = `
      PORT=3000 # default port
      NAME=myapp#not-a-comment-unless-spaced
    `;
    const parsed = parseEnv(src);
    expect(parsed.PORT).toBe("3000");
    expect(parsed.NAME).toBe("myapp#not-a-comment-unless-spaced");
  });

  it("should preserve # inside quoted values", () => {
    const src = `
      SECRET="my#password#with#hashes"
      COLOR='#ff0000'
    `;
    expect(parseEnv(src)).toEqual({
      SECRET: "my#password#with#hashes",
      COLOR: "#ff0000",
    });
  });

  it("should handle empty values", () => {
    const src = `
      EMPTY=
      EMPTY_QUOTED=""
    `;
    expect(parseEnv(src)).toEqual({
      EMPTY: "",
      EMPTY_QUOTED: "",
    });
  });

  it("should parse backtick quoted strings", () => {
    const src = "BACKTICK=`line 1\nline 2`";
    expect(parseEnv(src)).toEqual({
      BACKTICK: "line 1\nline 2",
    });
  });

  it("should handle unclosed quotes gracefully", () => {
    const src = 'UNCLOSED="hello without closing quote';
    expect(parseEnv(src)).toEqual({
      UNCLOSED: "hello without closing quote",
    });
  });

  it("should skip invalid lines without keys", () => {
    const src = "=value_without_key\n   \njust_a_word";
    expect(parseEnv(src)).toEqual({});
  });
});

describe("parseEnvFile", () => {
  it("should return empty object for non-existent file", () => {
    expect(parseEnvFile("/non/existent/path/.env")).toEqual({});
  });

  it("should read and parse existing file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-guard-test-"));
    const envPath = path.join(tmpDir, ".env");
    fs.writeFileSync(envPath, "TEST_VAR=passed\n");

    try {
      expect(parseEnvFile(envPath)).toEqual({
        TEST_VAR: "passed",
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
