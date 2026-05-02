import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceIconPath = path.join(rootDir, "icon.png");
const buildDir = path.join(rootDir, "build");
const icnsPath = path.join(buildDir, "icon.icns");
const icoPath = path.join(buildDir, "icon.ico");

const icnsEntries = [
  ["icp4", 16],
  ["icp5", 32],
  ["icp6", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024],
];

const icoSizes = [16, 24, 32, 48, 64, 128, 256];

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    const errorOutput = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} failed${errorOutput ? `: ${errorOutput}` : ""}`);
  }
}

function createIcoBuffer(images) {
  const headerSize = 6;
  const directoryEntrySize = 16;
  const directory = Buffer.alloc(headerSize + directoryEntrySize * images.length);

  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(images.length, 4);

  let offset = headerSize + directoryEntrySize * images.length;
  for (const [index, image] of images.entries()) {
    const entryOffset = headerSize + directoryEntrySize * index;
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, entryOffset);
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(image.data.length, entryOffset + 8);
    directory.writeUInt32LE(offset, entryOffset + 12);
    offset += image.data.length;
  }

  return Buffer.concat([directory, ...images.map((image) => image.data)]);
}

function createIcnsBuffer(images) {
  const chunks = images.map((image) => {
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.write(image.type, 0, 4, "ascii");
    chunkHeader.writeUInt32BE(image.data.length + 8, 4);
    return Buffer.concat([chunkHeader, image.data]);
  });

  const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const header = Buffer.alloc(8);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(totalLength, 4);

  return Buffer.concat([header, ...chunks]);
}

async function ensureSourceIcon() {
  const sourceStat = await stat(sourceIconPath).catch(() => null);
  if (!sourceStat?.isFile()) {
    throw new Error(`Source icon not found: ${sourceIconPath}`);
  }
}

async function generateIcns(tempDir) {
  const icnsDir = path.join(tempDir, "icns");
  await mkdir(icnsDir, { recursive: true });

  const images = [];
  for (const [type, size] of icnsEntries) {
    const resizedPath = path.join(icnsDir, `${type}-${size}.png`);
    runCommand("sips", ["-s", "format", "png", "-z", String(size), String(size), sourceIconPath, "--out", resizedPath]);
    images.push({
      type,
      data: await readFile(resizedPath),
    });
  }

  await writeFile(icnsPath, createIcnsBuffer(images));
}

async function generateIco(tempDir) {
  const icoDir = path.join(tempDir, "ico");
  await mkdir(icoDir, { recursive: true });

  const images = [];
  for (const size of icoSizes) {
    const resizedPath = path.join(icoDir, `icon-${size}.png`);
    runCommand("sips", ["-z", String(size), String(size), sourceIconPath, "--out", resizedPath]);
    images.push({
      size,
      data: await readFile(resizedPath),
    });
  }

  await writeFile(icoPath, createIcoBuffer(images));
}

async function main() {
  await ensureSourceIcon();
  await mkdir(buildDir, { recursive: true });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "workprocnavi-icons-"));
  try {
    await generateIcns(tempDir);
    await generateIco(tempDir);
    console.log(`Generated ${path.relative(rootDir, icnsPath)} and ${path.relative(rootDir, icoPath)}.`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
