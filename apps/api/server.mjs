// Vercel detects this JavaScript server entry point after the build command.
// Loading the production bundle avoids compiling the TypeScript source graph
// a second time with Vercel's per-file TypeScript compiler.
import "./dist/index.mjs";
