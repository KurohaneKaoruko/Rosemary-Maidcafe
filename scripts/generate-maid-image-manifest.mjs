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
  lines.push("export const maidImageAssets = {");
  for (const file of files) {
    lines.push(`  '/maid-image/${file}': ${toVarName(file)},`);
  }
  lines.push("} as const satisfies Record<string, StaticImageData>;");
  lines.push("");
  lines.push("export type MaidImagePath = keyof typeof maidImageAssets;");
  lines.push("");
  lines.push("export const maidImagePaths = Object.keys(maidImageAssets) as MaidImagePath[];");
  lines.push("");
  lines.push("export function resolveMaidImage(path: string): StaticImageData | null {");
  lines.push("  return maidImageAssets[path as MaidImagePath] ?? null;");
  lines.push("}");
  lines.push("");

  await fs.writeFile(outputFile, lines.join("\n"), "utf8");
  console.log(`Generated maid image manifest (${files.length} files): ${outputFile}`);
}

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
