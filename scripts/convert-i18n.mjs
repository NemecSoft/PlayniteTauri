// Converts the legacy TS i18n dictionaries (src/i18n/locales/*.ts) into
// JSON files under ./locales for i18next.
// Usage: node scripts/convert-i18n.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "locales");

const map = [
  { ts: "en.ts", json: "en.json" },
  { ts: "zh-CN.ts", json: "zh-CN.json" },
  { ts: "zh-TW.ts", json: "zh-TW.json" },
];

mkdirSync(localesDir, { recursive: true });

function tsObjectToJson(src) {
  // Remove whole-line `//` comments.
  let s = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  // Extract the object literal.
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  let body = s.slice(start, end + 1);
  // Quote unquoted property keys:  `appTitle:` -> `"appTitle":`
  body = body.replace(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/gm, '"$1"$2');
  // Remove trailing commas before } (JSON doesn't allow them).
  body = body.replace(/,\s*}/g, "}");
  return JSON.parse(body);
}

for (const { ts, json } of map) {
  const src = readFileSync(join(root, "src", "i18n", "locales", ts), "utf-8");
  const obj = tsObjectToJson(src);
  writeFileSync(join(localesDir, json), JSON.stringify(obj, null, 2), "utf-8");
  console.log(`converted ${ts} -> ${json} (${Object.keys(obj).length} keys)`);
}
