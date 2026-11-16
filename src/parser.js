import fs from "node:fs";
import path from "node:path";

/**
 * Parses a dotenv-formatted string into an object of key-value pairs.
 *
 * @param {string} src - The contents of a .env file.
 * @returns {Record<string, string>} Parsed key-value pairs.
 */
export function parseEnv(src) {
  const result = {};
  if (typeof src !== "string" || !src.trim()) {
    return result;
  }

  // Normalize line endings
  const lines = src.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();

    // Skip empty lines and comment lines
    if (!line || line.startsWith("#")) {
      i++;
      continue;
    }

    // Support optional "export " prefix
    if (line.startsWith("export ")) {
      line = line.slice(7).trim();
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      i++;
      continue;
    }

    const rawKey = line.slice(0, eqIndex).trim();
    // Validate key naming (alphanumeric and underscore)
    if (!rawKey) {
      i++;
      continue;
    }
    const key = rawKey;

    let rawVal = line.slice(eqIndex + 1).trim();

    // Check if the value starts with a quote
    if (rawVal.startsWith('"') || rawVal.startsWith("'") || rawVal.startsWith("`")) {
      const quoteChar = rawVal[0];

      // Check if closing quote is on the same line
      let valBuffer = rawVal.slice(1);
      let closed = false;

      // Find if closed on the same line
      let endQuoteIndex = -1;
      let escaped = false;
      for (let c = 0; c < valBuffer.length; c++) {
        const ch = valBuffer[c];
        if (quoteChar === '"' && ch === "\\" && !escaped) {
          escaped = true;
          continue;
        }
        if (ch === quoteChar && !escaped) {
          endQuoteIndex = c;
          closed = true;
          break;
        }
        escaped = false;
      }

      if (closed) {
        const inside = valBuffer.slice(0, endQuoteIndex);
        result[key] = unescapeQuoted(inside, quoteChar);
      } else {
        // Multi-line value
        const chunks = [valBuffer];
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          let endIdx = -1;
          let esc = false;
          for (let c = 0; c < nextLine.length; c++) {
            const ch = nextLine[c];
            if (quoteChar === '"' && ch === "\\" && !esc) {
              esc = true;
              continue;
            }
            if (ch === quoteChar && !esc) {
              endIdx = c;
              break;
            }
            esc = false;
          }

          if (endIdx !== -1) {
            chunks.push(nextLine.slice(0, endIdx));
            result[key] = unescapeQuoted(chunks.join("\n"), quoteChar);
            closed = true;
            break;
          } else {
            chunks.push(nextLine);
            i++;
          }
        }

        if (!closed) {
          // If never closed, preserve what was gathered
          result[key] = chunks.join("\n");
        }
      }
    } else {
      // Unquoted value: strip trailing comments if separated by whitespace
      const commentIdx = rawVal.indexOf(" #");
      if (commentIdx !== -1) {
        rawVal = rawVal.slice(0, commentIdx).trim();
      } else if (rawVal.startsWith("#")) {
        rawVal = "";
      }
      result[key] = rawVal;
    }

    i++;
  }

  return result;
}

/**
 * Handles escape characters inside quotes.
 *
 * @param {string} val
 * @param {string} quoteChar
 * @returns {string}
 */
function unescapeQuoted(val, quoteChar) {
  if (quoteChar === '"') {
    return val
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  if (quoteChar === "'") {
    return val.replace(/\\'/g, "'");
  }
  return val;
}

/**
 * Reads and parses an env file from disk if it exists.
 *
 * @param {string} filePath - Absolute or relative file path.
 * @returns {Record<string, string>} Parsed values, or empty object if file not found.
 */
export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return parseEnv(content);
  } catch {
    return {};
  }
}
