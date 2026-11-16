# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - Initial Release

### Added

- Schema-based environment configuration with `defineConfig()`.
- Built-in type coercion and validation for `string`, `number`, `boolean`, `url`, and `json`.
- Strict required value checking and default value fallback resolution.
- Constraints validation: `enum`, numeric ranges (`min`, `max`), string length bounds (`minLength`, `maxLength`), and RegExp `pattern`.
- Support for custom validation functions returning boolean or custom error messages.
- Comprehensive `ConfigurationError` system with error codes and structured metadata.
- Fail-fast mode and multiple error aggregation (`collectErrors: true`).
- Secret masking utility (`safeView` and `maskConfig`) with redaction across logs and error traces.
- Multi-environment profiles (`.env`, `.env.<profile>`, `process.env`).
- High-performance, zero-external-dependency `.env` parsing with multiline and quoted string support.
- Fully tested test suite with >97% branch and statement coverage.
- Interactive example scripts (`basic.js`, `validation.js`, `secrets.js`).
