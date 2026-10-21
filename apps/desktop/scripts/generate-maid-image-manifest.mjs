import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const assetsDir = path.join(projectRoot, "public", "maid-image");
const outputFile = path.join(projectRoot, "src", "assets", "maid-image", "index.ts");
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
  lines.push("/**");
  lines.push(" * 女仆图片资源清单（由 scripts/generate-maid-image-manifest.mjs 自动生成）。");
  lines.push(" * 所有图片放在 public/maid-image/ 下，通过 URL 直接引用（Vite 静态资源）。");
  lines.push(" */");
  lines.push("export type MaidImageAsset = string;");
  lines.push("");
  lines.push("export const maidImageAssets = {");
  for (const file of files) {
    lines.push(`  '/maid-image/${file}': '/maid-image/${file}',`);
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

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, lines.join("\n"), "utf8");
  console.log(`[maid-manifest] wrote ${files.length} entries -> ${path.relative(projectRoot, outputFile)}`);
}

generate().catch((error) => {
  console.error("[maid-manifest] failed:", error);
  process.exit(1);
});
