import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type NextRequest, NextResponse } from "next/server";
import {
	resolveCliExecutable,
	resolveCliWorkingDirectory,
} from "@/lib/server/winstro-runtime";

const execFileAsync = promisify(execFile);

type CliMode = "interactive" | "headless" | "write" | "backup" | "restore";

const MODE_FLAGS: Record<CliMode, string[]> = {
	interactive: [],
	headless: ["--headless"],
	write: ["--qwrite"],
	backup: ["--backup"],
	restore: ["--restore"],
};

function normalizeMode(value: unknown): CliMode {
	if (typeof value !== "string") {
		return "interactive";
	}

	const normalized = value.toLowerCase();
	if (normalized in MODE_FLAGS) {
		return normalized as CliMode;
	}

	return "interactive";
}

function psQuote(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

function toPowerShellArgumentList(args: string[]): string {
	return `@(${args.map((arg) => psQuote(arg)).join(", ")})`;
}

function buildBunCommand(flags: string[]): string {
	const joinedFlags = flags.join(" ");
	return joinedFlags.length > 0
		? `bun run main ${joinedFlags}`
		: "bun run main";
}

export async function POST(request: NextRequest) {
	try {
		const payload = await request.json().catch(() => ({}));
		const mode = normalizeMode(payload.mode);
		const flags = MODE_FLAGS[mode];

		const cliExecutable = await resolveCliExecutable();
		const winstroRoot = await resolveCliWorkingDirectory(
			cliExecutable ?? undefined,
		);

		if (cliExecutable) {
			const scriptParts = [
				"Start-Process",
				"-FilePath",
				psQuote(cliExecutable),
				"-WorkingDirectory",
				psQuote(winstroRoot),
			];

			if (flags.length > 0) {
				scriptParts.push("-ArgumentList", toPowerShellArgumentList(flags));
			}

			await execFileAsync(
				"powershell.exe",
				["-NoProfile", "-Command", scriptParts.join(" ")],
				{
					windowsHide: true,
				},
			);
		} else {
			const cliCommand = buildBunCommand(flags);
			const shellArgs = [
				"-NoExit",
				"-Command",
				`Set-Location -LiteralPath ${psQuote(winstroRoot)}; ${cliCommand}`,
			];

			const script = [
				"Start-Process",
				"-FilePath",
				psQuote("powershell.exe"),
				"-WorkingDirectory",
				psQuote(winstroRoot),
				"-ArgumentList",
				toPowerShellArgumentList(shellArgs),
			].join(" ");

			await execFileAsync(
				"powershell.exe",
				["-NoProfile", "-Command", script],
				{
					windowsHide: true,
				},
			);
		}

		return NextResponse.json({
			success: true,
			mode,
			launcher: cliExecutable ? "compiled-cli" : "bun",
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Unknown CLI launch error";
		console.error("CLI launch error:", error);
		return NextResponse.json(
			{
				success: false,
				error: message,
			},
			{ status: 500 },
		);
	}
}
