const fs = require("fs");
const dotenv = require("dotenv");
const envPath = require("path").join(__dirname, "../.env");
let PORT = 3000;
if (fs.existsSync(envPath)) {
  const env = dotenv.parse(fs.readFileSync(envPath));
  if (env.PORT) PORT = Number(env.PORT);
}

const indexPath = require("path").join(__dirname, "index.html");
let indexHtml = fs.readFileSync(indexPath, "utf8");
indexHtml = indexHtml.replace(
  /const\s+WS_PORT\s*=\s*.*?;/,
  `const WS_PORT = ${PORT};`,
);
fs.writeFileSync(indexPath, indexHtml, "utf8");

const { spawn } = require("child_process");
const path = require("path");
console.log("Starting backend server...");
const serverProc = spawn("bun", ["run", "app/server.ts"], {
  stdio: "inherit",
  env: { ...process.env, PORT: String(PORT) },
});

console.log("Waiting for backend to be ready...");
const waitForServer = async () => {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}`);
      if (res.ok) return true;
    } catch {
      await Bun.sleep(500);
    }
  }
  return false;
};

function getNeuBinary() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "linux") {
    if (arch === "arm")
      return path.join(__dirname, "../bin/neutralino-linux_armhf");
    if (arch === "arm64")
      return path.join(__dirname, "../bin/neutralino-linux_arm64");
    return path.join(__dirname, "../bin/neutralino-linux_x64");
  }
  if (platform === "darwin")
    return path.join(__dirname, "../bin/neutralino-mac_x64");
  if (platform === "win32")
    return path.join(__dirname, "../bin/neutralino-win_x64.exe");
  throw new Error(`Unsupported platform: ${platform}`);
}

if (await waitForServer()) {
  console.log("Backend ready. Launching Neutralino window...");
  const neuBin = getNeuBinary();
  const neuProc = spawn(
    neuBin,
    [
      "--load-dir-res",
      "--path=.",
      "--export-auth-info",
      `--url=http://localhost:${PORT}`,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        WEBKIT_DISABLE_COMPOSITING_MODE: "1",
        WEBKIT_DISABLE_DMABUF_RENDERER: "1",
        LIBGL_ALWAYS_SOFTWARE: "1",
      },
    },
  );
  neuProc.on("exit", (code: string | number | null | undefined) => {
    console.log(`Neutralino exited with code ${code}`);
    process.exit(code);
  });
} else {
  console.error("Backend server did not start in time.");
  process.exit(1);
}
