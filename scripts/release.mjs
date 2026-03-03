#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function fail(message) {
  console.error(`[release] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: options.stdio ?? 'pipe',
    encoding: 'utf8',
  });
}

function parseArgs(argv) {
  const options = {
    commit: false,
    tag: false,
    push: false,
    allowDirty: false,
    dryRun: false,
  };

  const positional = [];
  for (const arg of argv) {
    if (arg === '--commit') options.commit = true;
    else if (arg === '--tag') options.tag = true;
    else if (arg === '--push') options.push = true;
    else if (arg === '--allow-dirty') options.allowDirty = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 0) {
    fail('missing version argument');
  }

  const versionInput = positional[0];
  return { versionInput, options };
}

function printHelp() {
  console.log(`Usage:
  node scripts/release.mjs <version|major|minor|patch> [options]

Options:
  --commit       Create a release commit with updated versions
  --tag          Create git tag v<version> (implies --commit)
  --push         Push commit and tag (implies --tag --commit)
  --allow-dirty  Allow running with a dirty git working tree
  --dry-run      Show intended operations without writing files
  -h, --help     Show this help message

Examples:
  node scripts/release.mjs 0.2.0
  node scripts/release.mjs patch --commit --tag
  node scripts/release.mjs 1.0.0 --push
`);
}

function parseCoreVersion(version) {
  const match = version.match(SEMVER_RE);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function resolveNextVersion(input, currentVersion) {
  const bump = input.toLowerCase();
  const currentCore = parseCoreVersion(currentVersion);
  if (!currentCore) {
    fail(`current version "${currentVersion}" is not valid semver`);
  }

  if (bump === 'major') {
    return `${currentCore.major + 1}.0.0`;
  }
  if (bump === 'minor') {
    return `${currentCore.major}.${currentCore.minor + 1}.0`;
  }
  if (bump === 'patch') {
    return `${currentCore.major}.${currentCore.minor}.${currentCore.patch + 1}`;
  }

  if (!SEMVER_RE.test(input)) {
    fail(`invalid version "${input}"`);
  }
  return input;
}

function getDirtyFiles(repoRoot) {
  try {
    const output = run('git', ['status', '--porcelain'], { stdio: 'pipe' });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    fail('git status failed. Ensure git is installed and repository is initialized.');
  }
}

function updateCargoVersion(content, nextVersion) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const hasTrailingNewline = content.endsWith(newline);
  const body = hasTrailingNewline ? content.slice(0, -newline.length) : content;
  const lines = body.split(/\r?\n/);
  let inPackageSection = false;
  let replaced = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const sectionMatch = line.match(/^\s*\[(.+)\]\s*$/);
    if (sectionMatch) {
      inPackageSection = sectionMatch[1] === 'package';
      continue;
    }

    if (inPackageSection && /^\s*version\s*=\s*".*"\s*$/.test(line)) {
      lines[i] = `version = "${nextVersion}"`;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    fail('failed to locate [package] version in src-tauri/Cargo.toml');
  }

  const nextContent = lines.join(newline);
  return hasTrailingNewline ? `${nextContent}${newline}` : nextContent;
}

function writeJson(filePath, value, dryRun) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  if (!dryRun) {
    writeFileSync(filePath, next, 'utf8');
  }
}

function main() {
  const { versionInput, options } = parseArgs(process.argv.slice(2));
  if (options.push) {
    options.tag = true;
    options.commit = true;
  } else if (options.tag) {
    options.commit = true;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const lockJsonPath = path.join(repoRoot, 'package-lock.json');
  const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
  const cargoTomlPath = path.join(repoRoot, 'src-tauri', 'Cargo.toml');

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const lockJson = JSON.parse(readFileSync(lockJsonPath, 'utf8'));
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));
  const cargoToml = readFileSync(cargoTomlPath, 'utf8');

  const currentVersion = String(packageJson.version ?? '');
  const nextVersion = resolveNextVersion(versionInput, currentVersion);
  if (nextVersion === currentVersion) {
    fail(`next version equals current version (${currentVersion})`);
  }

  const requireCleanTree = options.commit || options.tag || options.push;
  if (requireCleanTree && !options.allowDirty) {
    const dirty = getDirtyFiles(repoRoot);
    if (dirty.length > 0) {
      fail(`working tree is dirty (${dirty.length} changes). Commit/stash first, or pass --allow-dirty.`);
    }
  }

  packageJson.version = nextVersion;
  lockJson.version = nextVersion;
  if (lockJson.packages?.['']) {
    lockJson.packages[''].version = nextVersion;
  }
  tauriConfig.version = nextVersion;
  const nextCargoToml = updateCargoVersion(cargoToml, nextVersion);

  console.log(`[release] ${currentVersion} -> ${nextVersion}`);
  console.log(`[release] update: package.json, package-lock.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml`);

  writeJson(packageJsonPath, packageJson, options.dryRun);
  writeJson(lockJsonPath, lockJson, options.dryRun);
  writeJson(tauriConfigPath, tauriConfig, options.dryRun);
  if (!options.dryRun) {
    writeFileSync(cargoTomlPath, nextCargoToml, 'utf8');
  }

  if (options.commit || options.tag || options.push) {
    if (options.dryRun) {
      console.log('[release] dry-run: skip git commit/tag/push');
    } else {
      const files = [
        'package.json',
        'package-lock.json',
        'src-tauri/tauri.conf.json',
        'src-tauri/Cargo.toml',
      ];

      run('git', ['add', ...files], { stdio: 'inherit' });
      run('git', ['commit', '-m', `chore(release): v${nextVersion}`], { stdio: 'inherit' });
      console.log(`[release] committed chore(release): v${nextVersion}`);

      if (options.tag) {
        const tagName = `v${nextVersion}`;
        let tagExists = false;
        try {
          run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`], { stdio: 'pipe' });
          tagExists = true;
        } catch {
          tagExists = false;
        }
        if (tagExists) {
          fail(`tag ${tagName} already exists`);
        }

        run('git', ['tag', tagName], { stdio: 'inherit' });
        console.log(`[release] tagged ${tagName}`);
      }

      if (options.push) {
        run('git', ['push'], { stdio: 'inherit' });
        run('git', ['push', 'origin', `v${nextVersion}`], { stdio: 'inherit' });
        console.log(`[release] pushed commit and v${nextVersion}`);
      }
    }
  }

  if (options.dryRun) {
    console.log('[release] dry-run complete');
  } else {
    console.log('[release] done');
  }
}

main();
