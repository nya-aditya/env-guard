export default [
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**", ".nyc_output/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        Symbol: "readonly",
        Error: "readonly",
        Set: "readonly",
        Object: "readonly",
        Array: "readonly",
        Number: "readonly",
        String: "readonly",
        Boolean: "readonly",
        JSON: "readonly",
        RegExp: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-constant-condition": "warn",
    },
  },
];
