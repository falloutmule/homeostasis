import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

const artifactPath = readArgument("--artifact");
const gatePath = readArgument("--gate");
const gate = JSON.parse(await readFile(gatePath, "utf8"));
const artifact = await readFile(artifactPath);
const artifactSha256 = createHash("sha256").update(artifact).digest("hex");

const failures = [];
if (gate.schema !== "homeostasis.release-gate@1") failures.push("unsupported release-gate schema");
if (gate.artifactSha256 !== artifactSha256) failures.push("release gate artifact SHA-256 does not match the packed artifact");
if (gate.releaseStatus !== "PASS") failures.push(`release status is ${String(gate.releaseStatus)}, not PASS`);
if (gate.physicalDevice?.target !== "Samsung Galaxy S21 Ultra / stable Android Chrome") failures.push("release gate does not target the required physical Samsung device");
if (gate.physicalDevice?.evidenceStatus !== "REPORTED") failures.push("physical-device evidence is not REPORTED");
if (gate.physicalDevice?.status !== "PASS") failures.push(`physical-device status is ${String(gate.physicalDevice?.status)}, not PASS`);

if (failures.length) {
  throw new Error(`GitHub Pages deployment blocked: ${failures.join("; ")}`);
}

console.log(JSON.stringify({ schema: "homeostasis.release-gate-verification@1", artifactSha256, buildId: gate.buildId, status: "PASS" }));
