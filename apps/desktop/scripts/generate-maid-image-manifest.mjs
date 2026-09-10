import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const assetsDir = path.join(projectRoot, "src-next", "assets", "maid-image");
const outputFile = path.join(assetsDir, "index.ts");
const supportedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

const toVarName = (fileName) => {
  const base = fileName.replace(/\.[^.]+$/, "");
  const ext = path.extname(fileName).replace(".", "") || "img";
  return `maid_${base}_${ext}`.replace(/[^a-zA-Z0-9_]/g, "_");
};

async function generate() {
  const entries = await fs.readdir(assetsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => supportedExt.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No maid image files found under: ${assetsDir}`);
  }

  const lines = [];
  lines.push("import type { StaticImageData } from 'next/image';");
  lines.push("");

  for (const file of files) {
    lines.push(`import ${toVarName(file)} from './${file}';`);
  }

  lines.push("");
  lines.push("export type MaidImageAsset = StaticImageData | string;");
  lines.push("");
  lines.push("export const maidImageAssets = {");
  for (const file of files) {
    lines.push(`  '/maid-image/${file}': ${toVarName(file)},`);
  }
  lines.push("} as const satisfies Record<string, MaidImageAsset>;");
  lines.push("");
  lines.push("export type MaidImagePath = keyof typeof maidImageAssets;");
  lines.push("");
  lines.push("export const maidImagePaths = Object.keys(maidImageAssets) as MaidImagePath[];");
  lines.push("");
  lines.push("const maidImageByFileName = Object.fromEntries(");
  lines.push("  Object.entries(maidImageAssets).map(([assetPath, data]) => [assetPath.split('/').pop()!.toLowerCase(), data])");
  lines.push(") as Record<string, MaidImageAsset>;");
  lines.push("");
  lines.push("export function normalizeMaidImagePath(path: string): string {");
  lines.push("  const trimmed = path.trim();");
  lines.push("  if (!trimmed) {");
  lines.push("    return '';");
  lines.push("  }");
  lines.push("");
  lines.push("  const withoutHash = trimmed.split('#')[0];");
  lines.push("  const withoutQuery = withoutHash.split('?')[0];");
  lines.push("  const normalizedSlashes = withoutQuery.replace(/\\\\\\\\/g, '/');");
  lines.push("");
  lines.push("  let pathname = normalizedSlashes;");
  lines.push("  if (/^https?:\\/\\//i.test(normalizedSlashes)) {");
  lines.push("    try {");
  lines.push("      pathname = new URL(normalizedSlashes).pathname;");
  lines.push("    } catch {");
  lines.push("      pathname = normalizedSlashes;");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  let decoded = pathname;");
  lines.push("  try {");
  lines.push("    decoded = decodeURIComponent(pathname);");
  lines.push("  } catch {");
  lines.push("    decoded = pathname;");
  lines.push("  }");
  lines.push("");
  lines.push("  const lowered = decoded.toLowerCase();");
  lines.push("  const marker = '/maid-image/';");
  lines.push("  const markerIndex = lowered.lastIndexOf(marker);");
  lines.push("  if (markerIndex >= 0) {");
  lines.push("    const suffix = decoded.slice(markerIndex);");
  lines.push("    const fileName = suffix.split('/').pop();");
  lines.push("    return fileName ? `${marker}${fileName.toLowerCase()}` : '';");
  lines.push("  }");
  lines.push("");
  lines.push("  const fileName = decoded.split('/').pop();");
  lines.push("  if (!fileName) {");
  lines.push("    return '';");
  lines.push("  }");
  lines.push("");
  lines.push("  return `${marker}${fileName.toLowerCase()}`;");
  lines.push("}");
  lines.push("");
  lines.push("export function resolveMaidImage(path: string): MaidImageAsset | null {");
  lines.push("  const normalizedPath = normalizeMaidImagePath(path);");
  lines.push("  if (!normalizedPath) {");
  lines.push("    return null;");
  lines.push("  }");
  lines.push("");
  lines.push("  const directMatch = maidImageAssets[normalizedPath as MaidImagePath];");
  lines.push("  if (directMatch) {");
  lines.push("    return directMatch;");
  lines.push("  }");
  lines.push("");
  lines.push("  const fileName = normalizedPath.split('/').pop();");
  lines.push("  if (!fileName) {");
  lines.push("    return null;");
  lines.push("  }");
  lines.push("");
  lines.push("  return maidImageByFileName[fileName.toLowerCase()] ?? null;");
  lines.push("}");
  lines.push("");

  await fs.writeFile(outputFile, lines.join("\n"), "utf8");
  console.log(`Generated maid image manifest (${files.length} files): ${outputFile}`);
}

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
