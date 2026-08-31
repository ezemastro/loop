import fs from "fs";
import path from "path";

/** Directories skipped by `walkTsFiles` — build output, VCS, and native platform folders. */
const SKIP_DIRS = new Set(["node_modules", ".expo", ".git", "android", "ios", "dist", "build"]);

/**
 * Recursively collects every `.ts`/`.tsx` file under `dir`, skipping `SKIP_DIRS` and dotfiles.
 * Shared by the brand-palette guard and the responsive-tokens source guards so all three walk
 * the same file set the same way.
 */
export function walkTsFiles(dir: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkTsFiles(fullPath, results);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}
