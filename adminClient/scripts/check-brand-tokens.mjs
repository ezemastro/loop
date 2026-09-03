#!/usr/bin/env node
/**
 * Drift guard between `client/config.ts` `DEFAULT_COLORS` (source of truth) and
 * `adminClient/src/styles/brand-tokens.css` (the duplicated `@theme` copy consumed by the
 * admin panel). `client/config.ts` cannot be imported here — it throws at module load when
 * `EXPO_PUBLIC_*` env vars are absent — so this script parses both files as plain text.
 *
 * Exits 0 with a notice when `client/config.ts` is absent (e.g. a checkout that only has
 * `adminClient/`). Exits 1 on any hex mismatch or a token missing from either side.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_CONFIG_PATH = resolve(__dirname, "../../client/config.ts");
const BRAND_TOKENS_PATH = resolve(__dirname, "../src/styles/brand-tokens.css");

// Maps each `DEFAULT_COLORS` key to its `brand-tokens.css` custom property.
const KEY_TO_TOKEN = {
  PRIMARY: "--color-brand-primary",
  SECONDARY: "--color-brand-secondary",
  TERTIARY: "--color-brand-tertiary",
  CREDITS: "--color-brand-credits",
  CREDITS_LIGHT: "--color-brand-credits-light",
  MAIN_TEXT: "--color-brand-text",
  SECONDARY_TEXT: "--color-brand-text-muted",
  STROKE: "--color-brand-stroke",
  BACKGROUND: "--color-brand-bg",
  ALERT: "--color-brand-alert",
};

function parseClientColors(source) {
  const block = source.match(/DEFAULT_COLORS\s*=\s*\{([\s\S]*?)\}/);
  if (!block) {
    throw new Error("Could not locate DEFAULT_COLORS in client/config.ts");
  }
  const colors = {};
  const entryPattern = /(\w+):\s*"(#[0-9a-fA-F]{6})"/g;
  let match;
  while ((match = entryPattern.exec(block[1])) !== null) {
    colors[match[1]] = match[2].toLowerCase();
  }
  return colors;
}

function parseThemeTokens(source) {
  const tokens = {};
  const entryPattern = /(--color-brand-[\w-]+):\s*(#[0-9a-fA-F]{6});/g;
  let match;
  while ((match = entryPattern.exec(source)) !== null) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

function main() {
  if (!existsSync(CLIENT_CONFIG_PATH)) {
    console.log(
      "check:tokens — client/config.ts is absent in this checkout; skipping drift check.",
    );
    process.exit(0);
  }

  const clientColors = parseClientColors(readFileSync(CLIENT_CONFIG_PATH, "utf8"));
  const themeTokens = parseThemeTokens(readFileSync(BRAND_TOKENS_PATH, "utf8"));

  const mismatches = [];

  for (const [key, token] of Object.entries(KEY_TO_TOKEN)) {
    const sourceValue = clientColors[key];
    const themeValue = themeTokens[token];
    if (!sourceValue) {
      mismatches.push(`client/config.ts is missing DEFAULT_COLORS.${key}`);
      continue;
    }
    if (!themeValue) {
      mismatches.push(`brand-tokens.css is missing ${token}`);
      continue;
    }
    if (sourceValue !== themeValue) {
      mismatches.push(
        `${key} → ${token}: client/config.ts has ${sourceValue}, brand-tokens.css has ${themeValue}`,
      );
    }
  }

  if (mismatches.length > 0) {
    console.error("check:tokens — brand token drift detected:");
    for (const line of mismatches) {
      console.error(`  - ${line}`);
    }
    process.exit(1);
  }

  console.log("check:tokens — brand-tokens.css matches client/config.ts DEFAULT_COLORS.");
}

main();
