# env-guard

> Schema-based environment configuration and validation for Node.js.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-87%20passed-success.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-97.5%25-brightgreen.svg)]()

Protect your Node.js applications from invalid, missing, incorrectly typed, or unsafe environment configurations before your server even starts.

---

## Why env-guard?

In Node.js applications, `process.env` presents significant operational risks:

- **Everything is an untyped string**: `process.env.PORT` is `"3000"`, not `3000`. `process.env.DEBUG` is `"false"` (which evaluates to truthy in boolean checks!).
- **Silent runtime failures**: Missing database URLs or invalid API keys often only surface minutes or hours into production execution during user requests.
- **Accidental credential leakage**: Passing unmasked `process.env` directly to loggers or APM dashboards risks leaking API secrets, database passwords, and private tokens.
- **Inconsistent multi-environment loading**: Managing local development, automated testing, and production environment overrides without clean precedence rules is error-prone.

### Raw `process.env` vs `env-guard`

```js
// ❌ With raw process.env
const port = parseInt(process.env.PORT, 10);  // NaN if missing/invalid!
const debug = process.env.DEBUG === "true";   // Manual boilerplate
const db = process.env.DATABASE_URL;          // Undefined until query fails!
console.log(process.env);                     // Leaks credentials to logs!
```

```js
// ✅ With env-guard
import { defineConfig, safeView } from "env-guard";

const config = defineConfig({
  PORT: { type: "number", default: 3000, min: 1024, max: 65535 },
  DEBUG: { type: "boolean", default: false },
  DATABASE_URL: { type: "string", required: true, secret: true }
});

console.log(config.PORT);       // 3000 (typed number)
console.log(config.DEBUG);      // false (typed boolean)
console.log(safeView(config));  // { PORT: 3000, DEBUG: false, DATABASE_URL: '********' }
```

---

## Features

- 🛡️ **Fail-Fast Validation**: Catch missing or malformed configuration at boot time.
- 🔄 **Strict Type Conversion**: Automatic coercion and validation for `string`, `number`, `boolean`, `url`, and `json`.
- 🔒 **Zero Secret Leakage**: Mask sensitive credentials in logs and prevent secret values from appearing in error traces.
- 🗂️ **Environment Profiles**: Clean layered configuration (.env &rarr; .env.&lt;profile&gt; &rarr; process.env).
- 🚨 **Collect Errors Mode**: Gather all schema violations in a single diagnostic report.
- 🎯 **Rich Constraints**: Ranges (`min`/`max`), string lengths (`minLength`/`maxLength`), regex patterns, and enums.
- 🪶 **Zero External Runtime Dependencies**: Lightweight, secure, and fast.
- 📦 **Modern ESM & TypeScript Support**: Full ESM exports with bundled TypeScript definitions (`.d.ts`).

---

## Installation

```bash
npm install env-guard
```

---

## Quick Start

Create a `.env` file in your project root:

```env
PORT=8080
NODE_ENV=development
DEBUG=true
API_URL=https://api.example.com
DATABASE_URL=postgres://user:secret@localhost:5432/app
```

Import `defineConfig` in your application entrypoint:

```js
import { defineConfig, safeView } from "env-guard";

export const config = defineConfig({
  PORT: {
    type: "number",
    default: 3000,
    min: 1,
    max: 65535,
  },
  NODE_ENV: {
    type: "string",
    required: true,
    enum: ["development", "production", "test"],
  },
  DEBUG: {
    type: "boolean",
    default: false,
  },
  API_URL: {
    type: "url",
    required: true,
  },
  DATABASE_URL: {
    type: "string",
    required: true,
    secret: true,
  },
});

// Access strongly-typed properties
console.log(`Server listening on port ${config.PORT}`);

// Safely log configuration without leaking credentials
console.log("Active configuration:", safeView(config));
```

---

## Schema Reference

Each field in your schema supports the following properties:

| Property | Type | Description |
| :--- | :--- | :--- |
| `type` | `"string"` \| `"number"` \| `"boolean"` \| `"url"` \| `"json"` | Desired target data type. Defaults to `"string"`. |
| `required` | `boolean` | When `true`, missing or blank environment variables trigger a `MISSING_REQUIRED` error. |
| `default` | `any` \| `() => any` | Fallback value if variable is omitted from environment. |
| `secret` | `boolean` | When `true`, redacts value in `safeView()`, `maskConfig()`, and error reports. |
| `enum` | `Array<any>` | Whitelist of acceptable values. |
| `min` | `number` | Minimum allowed value (for `"number"` type). |
| `max` | `number` | Maximum allowed value (for `"number"` type). |
| `minLength` | `number` | Minimum string character length (for `"string"` type). |
| `maxLength` | `number` | Maximum string character length (for `"string"` type). |
| `pattern` | `RegExp` \| `string` | Regular expression pattern the string must match. |
| `validate` | `(val: any) => boolean \| string` | Custom validator function. Return `true` to pass, or `false` / error string to fail. |
| `allowEmpty` | `boolean` | Allow empty strings when `required: true`. Defaults to `false`. |

---

## Supported Types

### 1. `string`
Accepts text values. Supports `minLength`, `maxLength`, and `pattern`.

```js
APP_NAME: {
  type: "string",
  minLength: 3,
  maxLength: 50,
}
```

### 2. `number`
Parses numeric strings into finite JavaScript numbers (integers or floating point). Rejects non-numeric strings, `NaN`, and `Infinity`.

```js
PORT: {
  type: "number",
  min: 1024,
  max: 65535,
  default: 3000,
}
```

### 3. `boolean`
Coerces common truthy and falsy representations (case-insensitive):
- **Truthy**: `"true"`, `"1"`, `"yes"`, `"t"`, `"on"`, `true`
- **Falsy**: `"false"`, `"0"`, `"no"`, `"f"`, `"off"`, `false`

```js
ENABLE_METRICS: {
  type: "boolean",
  default: false,
}
```

### 4. `url`
Validates standard URL formats (HTTP, HTTPS, Postgres, etc.) using the native WHATWG URL parser.

```js
WEBHOOK_URL: {
  type: "url",
  required: true,
}
```

### 5. `json`
Parses stringified JSON arrays and objects.

```js
CORS_ORIGINS: {
  type: "json",
  default: ["http://localhost:3000"],
}
```

---

## Validation Rules

### Required Values & Defaults Precedence
If a variable is missing:
- If `required: true` is set, `env-guard` immediately fails with `MISSING_REQUIRED` (required check takes precedence).
- If `required` is not true and `default` is defined, the default value (or return value of a default factory function) is applied.

```js
DATABASE_URL: {
  type: "string",
  required: true,
}
```

### Enum Validation
Enforces that a variable strictly matches one of the specified allowed values:

```js
LOG_LEVEL: {
  type: "string",
  enum: ["trace", "debug", "info", "warn", "error", "fatal"],
  default: "info",
}
```

### Range Validation
Enforces lower and upper bounds for numbers:

```js
MAX_WORKERS: {
  type: "number",
  min: 1,
  max: 128,
}
```

### Pattern / Regex Validation
Enforces string format requirements:

```js
TENANT_ID: {
  type: "string",
  pattern: /^tenant-[a-z0-9]{8}$/,
}
```

### Custom Validators
Run arbitrary logic. Support both boolean return and descriptive string return:

```js
WORKER_CONCURRENCY: {
  type: "number",
  validate: (val) => {
    if (val % 2 !== 0) {
      return "Concurrency must be an even number for thread pairing";
    }
    return true;
  },
}
```

---

## Secret Masking & Safe Logging

Never leak secrets into logs. When a variable is designated `secret: true`:

1. It is never logged in plaintext by `safeView()` or `maskConfig()`.
2. It is redacted as `[REDACTED]` in validation error messages and stack traces.

```js
import { defineConfig, safeView, maskConfig } from "env-guard";

const config = defineConfig({
  API_SECRET: { type: "string", required: true, secret: true },
  PORT: { type: "number", default: 3000 }
});

// safeView: convenient one-line masking
console.log(safeView(config));
// Output: { API_SECRET: "********", PORT: 3000 }

// maskConfig: customize mask appearance
console.log(maskConfig(config, undefined, { mask: "[CONFIDENTIAL]" }));
// Output: { API_SECRET: "[CONFIDENTIAL]", PORT: 3000 }
```

---

## Environment Profiles

`env-guard` supports layered profile loading. Pass `profile` or let `env-guard` auto-detect from `process.env.NODE_ENV`:

```js
const config = defineConfig(schema, {
  profile: "production", // loads .env then .env.production
});
```

### Precedence Hierarchy

```text
.env (Base defaults)
  ↓
.env.<profile> (e.g. .env.production, .env.development)
  ↓
process.env (System runtime environment / CI/CD secrets always win)
```

---

## Error Handling & Error Codes

All errors thrown by `env-guard` are instances of `ConfigurationError` and include structured metadata:

```js
try {
  defineConfig(schema);
} catch (err) {
  console.error(err.code);      // e.g. "MISSING_REQUIRED"
  console.error(err.variable);  // e.g. "DATABASE_URL"
  console.error(err.expected);  // e.g. "Value of type 'string'"
  console.error(err.received);  // e.g. "[REDACTED]" (if secret)
  console.error(err.message);
}
```

### Available Error Codes

| Code | Explanation |
| :--- | :--- |
| `MISSING_REQUIRED` | Variable is marked `required: true` but was missing or empty |
| `INVALID_TYPE` | Unsupported or mismatched schema type |
| `INVALID_NUMBER` | Could not convert string to a valid finite number |
| `INVALID_BOOLEAN` | Could not parse boolean representation |
| `INVALID_URL` | Malformed URL string |
| `INVALID_JSON` | Malformed JSON string |
| `INVALID_ENUM` | Value is not in the specified `enum` array |
| `OUT_OF_RANGE` | Numeric value violates `min` or `max` constraint |
| `INVALID_LENGTH` | String length violates `minLength` or `maxLength` |
| `INVALID_PATTERN` | String does not match RegExp `pattern` |
| `CUSTOM_VALIDATION_FAILED` | Custom validator returned `false` or an error string |
| `CONFIGURATION_SUMMARY_ERROR` | Thrown in `collectErrors` mode with multiple violations |
| `INVALID_SCHEMA` | Malformed schema definition provided to `defineConfig` |

### Error Collection Mode

By default, `env-guard` fails fast on the first error encountered. To report all validation problems in one batch:

```js
try {
  defineConfig(schema, { collectErrors: true });
} catch (err) {
  // Prints all collected violations numbered in order
  console.error(err.toDetailedString());
}
```

---

## API Reference

### `defineConfig(schema, options)`
Main configuration builder.

- **`schema`** (`Record<string, Rule>`): Schema definition.
- **`options`** (`object`):
  - `collectErrors` (`boolean`, default: `false`): Collect all errors before throwing.
  - `profile` (`string`): Environment profile (e.g. `"production"`). Defaults to `process.env.NODE_ENV`.
  - `envDir` (`string`, default: `process.cwd()`): Root directory to locate `.env` files.
  - `source` (`object`, default: `process.env`): Custom key-value map to read values from.
  - `loadEnv` (`boolean`, default: `true`): Whether to load `.env` files from disk.
  - `freeze` (`boolean`, default: `true`): `Object.freeze` the returned config object.

### `safeView(config, options)`
Returns a clone of `config` with all fields marked `secret: true` masked.

### `maskConfig(config, schema, options)`
Masks secrets in a configuration object using an explicit or attached schema.

### `parseEnv(src)`
Parses a dotenv-formatted string into key-value pairs.

### `parseEnvFile(filePath)`
Reads and parses a `.env` file from disk.

---

## Examples

Run any of the included examples:

```bash
node examples/basic.js
node examples/validation.js
node examples/secrets.js
```

---

## Testing

Run tests and coverage reports with Vitest:

```bash
npm test
npm run coverage
```

---

## Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
