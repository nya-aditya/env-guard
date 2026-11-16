/**
 * Supported data types in env-guard schemas.
 */
export type EnvGuardType = "string" | "number" | "boolean" | "url" | "json";

/**
 * Configuration schema definition for an individual environment variable.
 */
export interface FieldRule<T = any> {
  /**
   * Target data type for parsing and conversion.
   * Defaults to "string".
   */
  type?: EnvGuardType;

  /**
   * Whether the environment variable is strictly required.
   * Takes precedence over default values.
   */
  required?: boolean;

  /**
   * Default value (or value factory) if the variable is omitted from the environment.
   */
  default?: T | (() => T);

  /**
   * When true, hides the value in safeView(), maskConfig(), and error diagnostics.
   */
  secret?: boolean;

  /**
   * Allowed set of values.
   */
  enum?: readonly T[] | T[];

  /**
   * Minimum value bound (for "number" types).
   */
  min?: number;

  /**
   * Maximum value bound (for "number" types).
   */
  max?: number;

  /**
   * Minimum string character length (for "string" types).
   */
  minLength?: number;

  /**
   * Maximum string character length (for "string" types).
   */
  maxLength?: number;

  /**
   * RegExp pattern string or RegExp instance to match against (for "string" types).
   */
  pattern?: RegExp | string;

  /**
   * Custom validation function.
   * Return true to pass, or false / error string to fail validation.
   */
  validate?: (value: any) => boolean | string;

  /**
   * Allow empty strings when required: true. Defaults to false.
   */
  allowEmpty?: boolean;

  /**
   * Use default value if the environment variable is present but empty.
   */
  useDefaultOnEmpty?: boolean;

  /**
   * Optional human-readable documentation description.
   */
  description?: string;
}

/**
 * Top-level configuration schema.
 */
export type EnvGuardSchema = Record<string, FieldRule>;

/**
 * Options for defineConfig().
 */
export interface DefineConfigOptions {
  /**
   * If true, collects all schema errors instead of throwing on the first one.
   * Defaults to false.
   */
  collectErrors?: boolean;

  /**
   * Active environment profile name (e.g. "production", "development", "test").
   * Defaults to process.env.NODE_ENV.
   */
  profile?: string;

  /**
   * Directory where .env files are located. Defaults to process.cwd().
   */
  envDir?: string;

  /**
   * Raw key-value environment dictionary. Defaults to process.env.
   */
  source?: Record<string, string | undefined>;

  /**
   * Whether to load .env and profile files. Defaults to true.
   */
  loadEnv?: boolean;

  /**
   * Whether to freeze the returned configuration object. Defaults to true.
   */
  freeze?: boolean;
}

/**
 * Options for maskConfig and safeView.
 */
export interface MaskOptions {
  /**
   * Mask string (default "********") or masking callback function.
   */
  mask?: string | ((key: string, value: any) => string);
}

/**
 * Error codes emitted by env-guard.
 */
export const ERROR_CODES: {
  readonly MISSING_REQUIRED: "MISSING_REQUIRED";
  readonly INVALID_TYPE: "INVALID_TYPE";
  readonly INVALID_NUMBER: "INVALID_NUMBER";
  readonly INVALID_BOOLEAN: "INVALID_BOOLEAN";
  readonly INVALID_URL: "INVALID_URL";
  readonly INVALID_JSON: "INVALID_JSON";
  readonly INVALID_ENUM: "INVALID_ENUM";
  readonly OUT_OF_RANGE: "OUT_OF_RANGE";
  readonly INVALID_LENGTH: "INVALID_LENGTH";
  readonly INVALID_PATTERN: "INVALID_PATTERN";
  readonly CUSTOM_VALIDATION_FAILED: "CUSTOM_VALIDATION_FAILED";
  readonly CONFIGURATION_SUMMARY_ERROR: "CONFIGURATION_SUMMARY_ERROR";
  readonly INVALID_SCHEMA: "INVALID_SCHEMA";
};

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Custom error class for configuration and validation failures.
 */
export class ConfigurationError extends Error {
  readonly name: "ConfigurationError";
  readonly code: ErrorCode;
  readonly variable: string | null;
  readonly expected: unknown;
  readonly received: unknown;
  readonly errors: ConfigurationError[];

  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      variable?: string;
      expected?: unknown;
      received?: unknown;
      errors?: ConfigurationError[];
      secret?: boolean;
    }
  );

  toDetailedString(): string;
  toJSON(): Record<string, any>;
}

/**
 * Symbol used to store schema metadata on frozen configuration objects.
 */
export const SCHEMA_SYMBOL: unique symbol;

/**
 * Defines, loads, and validates environment variables against a schema.
 */
export function defineConfig<T extends EnvGuardSchema>(
  schema: T,
  options?: DefineConfigOptions
): Record<string, any>;

/**
 * Returns a clone of config with all sensitive fields masked.
 */
export function safeView<T extends Record<string, any>>(
  config: T,
  options?: MaskOptions
): T;

/**
 * Masks sensitive fields in config according to the provided or attached schema.
 */
export function maskConfig<T extends Record<string, any>>(
  config: T,
  schema?: EnvGuardSchema,
  options?: MaskOptions
): T;

/**
 * Parses a dotenv-formatted string into key-value pairs.
 */
export function parseEnv(src: string): Record<string, string>;

/**
 * Reads and parses an env file from disk if it exists.
 */
export function parseEnvFile(filePath: string): Record<string, string>;

/**
 * Loads environment files in priority order for the given profile.
 */
export function loadEnvironmentSources(options?: {
  profile?: string;
  envDir?: string;
  source?: Record<string, string | undefined>;
}): Record<string, string>;

/**
 * Validates a single field according to schema definition and converts its type.
 */
export function validateField(
  key: string,
  rawValue: unknown,
  rule?: FieldRule
): { valid: boolean; value?: unknown; error?: ConfigurationError };

/**
 * Validates a complete schema against raw environment variables.
 */
export function validateSchema(
  schema: EnvGuardSchema,
  rawEnv?: Record<string, string>
): {
  valid: boolean;
  config: Record<string, any>;
  errors: ConfigurationError[];
};

export const VERSION: string;
