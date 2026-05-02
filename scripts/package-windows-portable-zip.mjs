import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import packageJson from "../package.json" with { type: "json" };

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(rootDir, "release");

const portableExeName = `${packageJson.productName}-${packageJson.version}-win-portable-x64.exe`;
const outputZipName = `${packageJson.productName}-${packageJson.version}-win-x64.zip`;

const portableExePath = path.join(releaseDir, portableExeName);
const outputZipPath = path.join(releaseDir, outputZipName);

const portableExeBuffer = await readFile(portableExePath);

const zip = new JSZip();
zip.file(`${packageJson.productName}.exe`, portableExeBuffer, {
  binary: true,
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});

const zipBuffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});

await writeFile(outputZipPath, zipBuffer);
console.log(`Created ${path.relative(rootDir, outputZipPath)} from ${portableExeName}.`);
