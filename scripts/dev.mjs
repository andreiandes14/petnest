import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const processes = [
  spawn(npmCommand, ["run", "dev"], {
    cwd: "artifacts/petnest",
    env: { ...process.env, PORT: "5173" },
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
  spawn(npmCommand, ["run", "dev"], {
    cwd: "artifacts/api-server",
    env: { ...process.env, PORT: "5000" },
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
];

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) child.kill();
  }

  process.exitCode = exitCode;
}

for (const child of processes) {
  child.on("error", () => shutdown(1));
  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());