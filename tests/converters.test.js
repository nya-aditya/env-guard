import { describe, it, expect } from "vitest";
import {
  convertString,
  convertNumber,
  convertBoolean,
  convertUrl,
  convertJson,
  CONVERTERS,
} from "../src/converters.js";

describe("converters", () => {
  describe("convertString", () => {
    it("converts values to strings", () => {
      expect(convertString("hello")).toEqual({ success: true, value: "hello" });
      expect(convertString(123)).toEqual({ success: true, value: "123" });
      expect(convertString(true)).toEqual({ success: true, value: "true" });
    });

    it("rejects null or undefined", () => {
      expect(convertString(null).success).toBe(false);
      expect(convertString(undefined).success).toBe(false);
    });
  });

  describe("convertNumber", () => {
    it("converts integers, floats, zeros, and negative numbers", () => {
      expect(convertNumber("3000")).toEqual({ success: true, value: 3000 });
      expect(convertNumber("0")).toEqual({ success: true, value: 0 });
      expect(convertNumber("-42")).toEqual({ success: true, value: -42 });
      expect(convertNumber("3.1415")).toEqual({ success: true, value: 3.1415 });
      expect(convertNumber(8080)).toEqual({ success: true, value: 8080 });
    });

    it("rejects empty string, whitespace, non-numeric strings, and infinities", () => {
      expect(convertNumber("").success).toBe(false);
      expect(convertNumber("   ").success).toBe(false);
      expect(convertNumber("abc").success).toBe(false);
      expect(convertNumber("12abc").success).toBe(false);
      expect(convertNumber(Infinity).success).toBe(false);
      expect(convertNumber(NaN).success).toBe(false);
      expect(convertNumber(null).success).toBe(false);
    });
  });

  describe("convertBoolean", () => {
    it("converts truthy values", () => {
      for (const val of ["true", "TRUE", "True", "1", "yes", "YES", "t", "on", true]) {
        expect(convertBoolean(val)).toEqual({ success: true, value: true });
      }
    });

    it("converts falsy values", () => {
      for (const val of ["false", "FALSE", "False", "0", "no", "NO", "f", "off", false]) {
        expect(convertBoolean(val)).toEqual({ success: true, value: false });
      }
    });

    it("rejects invalid boolean representations", () => {
      expect(convertBoolean("maybe").success).toBe(false);
      expect(convertBoolean("2").success).toBe(false);
      expect(convertBoolean("").success).toBe(false);
      expect(convertBoolean(null).success).toBe(false);
    });
  });

  describe("convertUrl", () => {
    it("converts and normalizes valid URLs", () => {
      expect(convertUrl("https://example.com")).toEqual({
        success: true,
        value: "https://example.com/",
      });
      expect(convertUrl("http://localhost:3000/api/v1")).toEqual({
        success: true,
        value: "http://localhost:3000/api/v1",
      });
      expect(convertUrl("postgres://user:pass@localhost:5432/db")).toEqual({
        success: true,
        value: "postgres://user:pass@localhost:5432/db",
      });
    });

    it("rejects invalid URLs", () => {
      expect(convertUrl("hello").success).toBe(false);
      expect(convertUrl("/relative/path").success).toBe(false);
      expect(convertUrl("").success).toBe(false);
      expect(convertUrl(null).success).toBe(false);
    });
  });

  describe("convertJson", () => {
    it("parses valid JSON strings and preserves objects", () => {
      expect(convertJson('{"darkMode":true,"theme":"dark"}')).toEqual({
        success: true,
        value: { darkMode: true, theme: "dark" },
      });
      expect(convertJson('[1,2,3]')).toEqual({
        success: true,
        value: [1, 2, 3],
      });
      expect(convertJson({ already: "parsed" })).toEqual({
        success: true,
        value: { already: "parsed" },
      });
    });

    it("rejects invalid JSON", () => {
      expect(convertJson("{broken").success).toBe(false);
      expect(convertJson("not json").success).toBe(false);
      expect(convertJson("").success).toBe(false);
      expect(convertJson(null).success).toBe(false);
    });
  });

  describe("CONVERTERS map", () => {
    it("contains all expected converter keys", () => {
      expect(Object.keys(CONVERTERS).sort()).toEqual([
        "boolean",
        "json",
        "number",
        "string",
        "url",
      ]);
    });
  });
});
