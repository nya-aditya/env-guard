/**
 * Supported converter types and their transformation logic.
 */

const TRUTHY_BOOLEANS = new Set(["true", "1", "yes", "t", "on"]);
const FALSY_BOOLEANS = new Set(["false", "0", "no", "f", "off"]);

/**
 * Converts a raw environment value to a string.
 *
 * @param {unknown} value
 * @returns {{ success: boolean, value?: string, error?: string }}
 */
export function convertString(value) {
  if (value === undefined || value === null) {
    return { success: false, error: "Value is null or undefined" };
  }
  return { success: true, value: String(value) };
}

/**
 * Converts a raw environment value to a finite number.
 *
 * @param {unknown} value
 * @returns {{ success: boolean, value?: number, error?: string }}
 */
export function convertNumber(value) {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return { success: true, value };
    }
    return { success: false, error: "Number must be finite" };
  }

  if (typeof value !== "string" || value.trim() === "") {
    return { success: false, error: "Expected valid numeric string" };
  }

  const trimmed = value.trim();
  const num = Number(trimmed);

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { success: false, error: `Cannot convert "${value}" to number` };
  }

  return { success: true, value: num };
}

/**
 * Converts a raw environment value to a boolean.
 *
 * @param {unknown} value
 * @returns {{ success: boolean, value?: boolean, error?: string }}
 */
export function convertBoolean(value) {
  if (typeof value === "boolean") {
    return { success: true, value };
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TRUTHY_BOOLEANS.has(normalized)) {
      return { success: true, value: true };
    }
    if (FALSY_BOOLEANS.has(normalized)) {
      return { success: true, value: false };
    }
  }

  return {
    success: false,
    error: `Expected boolean (true/false, 1/0, yes/no), received "${value}"`,
  };
}

/**
 * Converts and validates a raw environment value as a valid URL.
 *
 * @param {unknown} value
 * @returns {{ success: boolean, value?: string, error?: string }}
 */
export function convertUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { success: false, error: "Expected valid URL string" };
  }

  try {
    const parsed = new URL(value.trim());
    return { success: true, value: parsed.href };
  } catch {
    return { success: false, error: `Invalid URL format: "${value}"` };
  }
}

/**
 * Converts and validates a raw environment value as JSON.
 *
 * @param {unknown} value
 * @returns {{ success: boolean, value?: any, error?: string }}
 */
export function convertJson(value) {
  if (typeof value === "object" && value !== null) {
    return { success: true, value };
  }

  if (typeof value !== "string" || !value.trim()) {
    return { success: false, error: "Expected valid JSON string" };
  }

  try {
    const parsed = JSON.parse(value.trim());
    return { success: true, value: parsed };
  } catch (err) {
    return { success: false, error: `Invalid JSON: ${err.message}` };
  }
}

export const CONVERTERS = {
  string: convertString,
  number: convertNumber,
  boolean: convertBoolean,
  url: convertUrl,
  json: convertJson,
};
