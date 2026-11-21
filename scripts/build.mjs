import { build } from "esbuild";


await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: "dist/index.js",
  banner: {
    // shebang + require shim for CommonJS deps bundled into ESM
    js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  legalComments: "none",
  minify: true,
  logLevel: "info",
});
