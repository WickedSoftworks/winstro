import { spawn } from "node:child_process";
import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(uiRoot, "..", "..");

const standaloneDir = path.join(uiRoot, ".next", "standalone");
const staticDir = path.join(uiRoot, ".next", "static");
const publicDir = path.join(uiRoot, "public");

const electronDistRoot = path.join(uiRoot, "electron-dist");
const runtimeOutDir = path.join(electronDistRoot, "app-runtime");
const cliOutDir = path.join(electronDistRoot, "winstro-cli");
const defaultsOutDir = path.join(electronDistRoot, "defaults");

const cliExecutableOut = path.join(cliOutDir, "winstro-cli.exe");

async function pathExists(targetPath) {
	try {
		await access(targetPath);
		return true;
	} catch {
		return false;
	}
}

function runCommand(command, args, cwd) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: "inherit",
			shell: true,
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${command} exited with code ${code}`));
			}
		});
	});
}

async function prepare() {
	if (!(await pathExists(standaloneDir))) {
		// Run Next.js build automatically instead of erroring out
		console.log("[winstro::electron] Next standalone build missing. Running build...");
		await runCommand("bun", ["run", "build"], uiRoot);
		
		if (!(await pathExists(standaloneDir))) {
			throw new Error(
				`Failed to generate Next standalone build at ${standaloneDir}`,
			);
		}
	}

	await rm(electronDistRoot, { recursive: true, force: true });
	await mkdir(runtimeOutDir, { recursive: true });
	await cp(standaloneDir, runtimeOutDir, { recursive: true, force: true });

	if (await pathExists(staticDir)) {
		await mkdir(path.join(runtimeOutDir, ".next"), { recursive: true });
		await cp(staticDir, path.join(runtimeOutDir, ".next", "static"), {
			recursive: true,
			force: true,
		});
	}

	if (await pathExists(publicDir)) {
		await cp(publicDir, path.join(runtimeOutDir, "public"), {
			recursive: true,
			force: true,
		});
	}

	await mkdir(cliOutDir, { recursive: true });
	await runCommand(
		"bun",
		[
			"build",
			"--compile",
			"--target=bun-windows-x64",
			"--minify",
			"--sourcemap=none",
			path.join(repoRoot, "main.ts"),
			"--outfile",
			cliExecutableOut,
		],
		repoRoot,
	);

	await mkdir(defaultsOutDir, { recursive: true });
	await cp(path.join(repoRoot, "config"), path.join(defaultsOutDir, "config"), {
		recursive: true,
		force: true,
	});

	console.log(
		"[winstro::electron] Prepared Electron build assets successfully.",
	);
}

prepare().catch((error) => {
	console.error("[winstro::electron] Failed to prepare assets:", error);
	process.exit(1);
});
