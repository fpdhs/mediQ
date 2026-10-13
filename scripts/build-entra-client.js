import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "public", "vendor");

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  build({
    absWorkingDir: projectRoot,
    entryPoints: ["src/entra-browser-client-entry.js"],
    outfile: path.join(outputDirectory, "msal-browser.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    minify: true,
    legalComments: "none",
    sourcemap: false,
  }),
  build({
    absWorkingDir: projectRoot,
    entryPoints: ["src/entra-redirect-entry.js"],
    outfile: path.join(outputDirectory, "entra-redirect.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    minify: true,
    legalComments: "none",
    sourcemap: false,
  }),
]);
