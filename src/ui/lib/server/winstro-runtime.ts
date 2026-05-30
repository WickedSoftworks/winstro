import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_PROCESS_BUFFER = 10 * 1024 * 1024;

async function exists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function looksLikeWinstroRoot(directory: string): Promise<boolean> {
	const mainEntry = path.join(directory, "main.ts");
	const requirementsFile = path.join(
		directory,
		"config",
		"requirements.winget.ts",
	);
	return (await exists(mainEntry)) && (await exists(requirementsFile));
}

export async function resolveWinstroRoot(): Promise<string> {
	const envRoot = process.env.WINSTRO_ROOT?.trim();
	const candidates = [
		envRoot,
		path.resolve(process.cwd(), "../.."),
		path.resolve(process.cwd(), "../../.."),
		path.resolve(process.cwd(), ".."),
		process.cwd(),
	]
		.filter((candidate): candidate is string => Boolean(candidate))
		.map((candidate) => path.resolve(candidate));

	for (const candidate of Array.from(new Set(candidates))) {
		if (await looksLikeWinstroRoot(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		`Could not locate winstro root. Tried: ${Array.from(new Set(candidates)).join(", ")}`,
	);
}

export async function resolveRequirementsPath(): Promise<string> {
	const envRequirements = process.env.WINSTRO_REQUIREMENTS_FILE?.trim();
	if (envRequirements && (await exists(envRequirements))) {
		return path.resolve(envRequirements);
	}

	const root = await resolveWinstroRoot();
	const requirementsPath = path.join(root, "config", "requirements.winget.ts");
	if (await exists(requirementsPath)) {
		return requirementsPath;
	}

	throw new Error(
		`Could not locate requirements.winget.ts at expected path: ${requirementsPath}`,
	);
}

export async function resolveCliExecutable(
	rootPath?: string,
): Promise<string | null> {
	const envCliExecutable = process.env.WINSTRO_CLI_EXE?.trim();
	if (envCliExecutable) {
		const normalized = path.resolve(envCliExecutable);
		if (await exists(normalized)) {
			return normalized;
		}
	}

	const root = rootPath ?? (await resolveWinstroRoot());
	const candidates = [
		path.join(root, "winstro-cli.exe"),
		path.join(root, "bin", "winstro-cli.exe"),
	];

	for (const candidate of Array.from(
		new Set(candidates.map((item) => path.resolve(item))),
	)) {
		if (await exists(candidate)) {
			return candidate;
		}
	}

	return null;
}

export async function resolveCliWorkingDirectory(
	cliExecutable?: string,
): Promise<string> {
	const envRoot = process.env.WINSTRO_ROOT?.trim();
	if (envRoot) {
		return path.resolve(envRoot);
	}

	try {
		return await resolveWinstroRoot();
	} catch {
		const requirementsPath = process.env.WINSTRO_REQUIREMENTS_FILE?.trim();
		if (requirementsPath) {
			return path.resolve(path.dirname(path.dirname(requirementsPath)));
		}

		if (cliExecutable) {
			return path.resolve(path.dirname(cliExecutable));
		}

		return process.cwd();
	}
}

export async function runWinstroMain(
	flags: string[],
	envOverrides: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string }> {
	const cliExecutable = await resolveCliExecutable().catch(() => null);

	if (cliExecutable) {
		const workingDirectory = await resolveCliWorkingDirectory(cliExecutable);
		return execFileAsync(cliExecutable, flags, {
			cwd: workingDirectory,
			env: { ...process.env, ...envOverrides },
			maxBuffer: MAX_PROCESS_BUFFER,
			windowsHide: true,
		});
	}

	const root = await resolveWinstroRoot();
	const bunExecutable = process.env.WINSTRO_BUN_PATH?.trim() || "bun";
	return execFileAsync(bunExecutable, ["run", "main", ...flags], {
		cwd: root,
		env: { ...process.env, ...envOverrides },
		maxBuffer: MAX_PROCESS_BUFFER,
		windowsHide: true,
	});
}
