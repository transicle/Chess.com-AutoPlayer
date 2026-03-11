const PORT = Number(process.env.PORT ?? 3000);

function getNeuBinary(): string {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === "linux") {
        if (arch === "arm") return "./bin/neutralino-linux_armhf";
        if (arch === "arm64") return "./bin/neutralino-linux_arm64";
        return "./bin/neutralino-linux_x64";
    }
    if (platform === "darwin") return "./bin/neutralino-mac_x64";
    if (platform === "win32") return "./bin/neutralino-win_x64.exe";
    throw new Error(`Unsupported platform: ${platform}`);
}

console.log("Starting backend server...");

const server = Bun.spawn(["bun", "run", "app/server.ts"], {
    stdout: "inherit",
    stderr: "inherit",
});

console.log("Waiting for server...");
for (let i = 0; i < 30; i++) {
    try {
        const res = await fetch(`http://localhost:${PORT}`);
        if (res.ok) break;
    } catch {
        await Bun.sleep(500);
    }
}

console.log("Server ready. Opening window...");

const neu = Bun.spawn([getNeuBinary(), "--load-dir-res", "--path=.", "--export-auth-info", `--url=http://localhost:${PORT}`], {
    stdout: "inherit",
    stderr: "inherit",
    env: {
        ...process.env,
        WEBKIT_DISABLE_COMPOSITING_MODE: "1",
        WEBKIT_DISABLE_DMABUF_RENDERER: "1",
        LIBGL_ALWAYS_SOFTWARE: "1",
    },
});

await neu.exited;
server.kill();
process.exit(0);

