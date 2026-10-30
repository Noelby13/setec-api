#!/usr/bin/env node
/** Cache only the manifest's demo covers under the public-program filename prefix. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/cache-demo-media.mjs');
  console.log('Caches manifest image_download_url assets as public /uploads/programas/demo-v2-* covers.');
  console.log('Existing valid files are reused; no credentials or dependencies are used.');
  process.exit(0);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'database', 'demo_media.json');
const publicDir = path.join(repoRoot, 'uploads', 'programas');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entries = Object.entries(manifest.entries);
const allowedPath = /^\/uploads\/programas\/demo-v2-[a-z0-9-]+\.(?:jpg|png)$/;

function imageFormat(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  return null;
}

function validLocal(bytes, extension) {
  return bytes.length > 128 && bytes.length <= 12 * 1024 * 1024 && imageFormat(bytes) === extension;
}

const groups = new Map();
for (const [careerKey, entry] of entries) {
  const url = entry.image_download_url;
  if (!/^https:\/\//i.test(url || '')) throw new Error(`${careerKey}: missing HTTPS image_download_url`);
  if (!allowedPath.test(entry.image_url || '')) throw new Error(`${careerKey}: refusing non-demo public path`);
  const targetName = path.basename(entry.image_url);
  const extension = path.extname(targetName).slice(1);
  const group = groups.get(url) || { url, targets: [], extension };
  if (group.extension !== extension) throw new Error(`${careerKey}: shared source has inconsistent file type`);
  group.targets.push({ careerKey, targetName });
  groups.set(url, group);
}

await mkdir(publicDir, { recursive: true });
for (const { url, targets, extension } of groups.values()) {
  let bytes;
  let origin = 'download';
  let responseStatus = null;
  for (const target of targets) {
    try {
      const existing = await readFile(path.join(publicDir, target.targetName));
      if (validLocal(existing, extension)) {
        bytes = existing;
        origin = `existing cache ${target.targetName}`;
        break;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  let responseType = 'local-cache';
  if (!bytes) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'setec-demo-media-cache/1.0 (public program cover retrieval)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    responseStatus = response.status;
    responseType = response.headers.get('content-type') || 'unknown';
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    if (!responseType.toLowerCase().startsWith(`image/${extension === 'jpg' ? 'jpeg' : extension}`)) {
      throw new Error(`${url}: expected image/${extension === 'jpg' ? 'jpeg' : extension}, received ${responseType}`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
    if (!validLocal(bytes, extension)) throw new Error(`${url}: invalid or oversized ${extension} image payload`);
  }

  for (const { careerKey, targetName } of targets) {
    const targetPath = path.join(publicDir, targetName);
    let alreadyValid = false;
    try { alreadyValid = validLocal(await readFile(targetPath), extension); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!alreadyValid) await writeFile(targetPath, bytes, { flag: 'w' });
    console.log(`${careerKey}: ${targetName} ${alreadyValid ? 'verified-existing' : origin} ${extension === 'jpg' ? 'image/jpeg' : 'image/png'} ${bytes.length}`);
  }
  if (origin === 'download') console.log(`  source response: HTTP ${responseStatus} ${responseType}`);
}
