import { exec } from "node:child_process";
import { promisify } from "node:util";
import { type NextRequest, NextResponse } from "next/server";

const execAsync = promisify(exec);

type WingetPackage = {
	name: string;
	id: string;
	version: string;
};

function isVersionLike(value: string): boolean {
	return /^\d+(?:[.-]\d+)*(?:[-+].+)?$/.test(value);
}

function isLikelyWingetId(value: string): boolean {
	if (!value) {
		return false;
	}

	const trimmed = value.trim();
	if (!trimmed || /\s/.test(trimmed)) {
		return false;
	}

	if (trimmed === "Id" || trimmed.includes("--") || trimmed.includes("…")) {
		return false;
	}

	// Winget IDs are expected to include letters and should not look like raw versions.
	return /[A-Za-z]/.test(trimmed) && !isVersionLike(trimmed);
}

function parseWingetListOutput(output: string): WingetPackage[] {
	const lines = output.split(/\r?\n/);
	const packages: WingetPackage[] = [];
	const seenIds = new Set<string>();

	let separatorIndex = -1;
	for (let i = 0; i < lines.length; i++) {
		if (/^-+\s+-+/.test(lines[i].trim())) {
			separatorIndex = i;
			break;
		}
	}

	const dataStartIndex = separatorIndex >= 0 ? separatorIndex + 1 : 2;
	const separatorLine = separatorIndex >= 0 ? lines[separatorIndex] : "";
	const dashSegments = Array.from(separatorLine.matchAll(/-+/g));
	const hasColumnMap = dashSegments.length >= 3;

	for (let i = dataStartIndex; i < lines.length; i++) {
		const rawLine = lines[i];
		const line = rawLine.trim();

		if (
			line.length === 0 ||
			line.includes("upgrades available") ||
			(line.includes("package") && line.includes("available")) ||
			line.startsWith("The following")
		) {
			continue;
		}

		let name = "";
		let id = "";
		let version = "";

		if (hasColumnMap) {
			const columns = dashSegments.map((segment, index) => {
				const start = segment.index ?? 0;
				const end =
					index < dashSegments.length - 1
						? (dashSegments[index + 1].index ?? rawLine.length)
						: rawLine.length;

				return rawLine.slice(start, end).trim();
			});

			name = columns[0] ?? "";
			id = columns[1] ?? "";
			version = columns[2] ?? "";
		} else {
			const parts = line.split(/\s{2,}/);
			if (parts.length < 3) {
				continue;
			}

			name = parts[0]?.trim() ?? "";
			id = parts[1]?.trim() ?? "";
			version = parts[2]?.trim() ?? "";
		}

		if (!isLikelyWingetId(id) || seenIds.has(id)) {
			continue;
		}

		packages.push({ name, id, version });
		seenIds.add(id);
	}

	return packages;
}

// In-memory cache
let packageCache: { packages: WingetPackage[]; timestamp: number } | null =
	null;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const skipCache = searchParams.get("skipCache") === "true";

		// Return cached data if available and fresh
		if (
			!skipCache &&
			packageCache &&
			Date.now() - packageCache.timestamp < CACHE_TTL
		) {
			return NextResponse.json({
				packages: packageCache.packages,
				cached: true,
			});
		}

		// Use --accept-source-agreements to avoid prompts and speed up
		const { stdout } = await execAsync(
			"winget list --accept-source-agreements",
			{
				shell: "powershell.exe",
				timeout: 30000, // 30 second timeout
			},
		);

		const packages = parseWingetListOutput(stdout);

		// Update cache
		packageCache = {
			packages,
			timestamp: Date.now(),
		};

		return NextResponse.json({
			packages,
			cached: false,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Unknown packages error";
		console.error("Packages GET error:", error);
		// If cache exists and command fails, return stale cache
		if (packageCache) {
			return NextResponse.json({
				packages: packageCache.packages,
				cached: true,
				stale: true,
				error: `Using cached data due to error: ${message}`,
			});
		}
		return NextResponse.json({ packages: [], error: message }, { status: 200 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const { packageId, action } = await request.json();

		if (!packageId || !action) {
			return NextResponse.json(
				{ error: "Package ID and action required" },
				{ status: 400 },
			);
		}

		let command = "";
		if (action === "install") {
			command = `winget install --id ${packageId} --accept-package-agreements --accept-source-agreements`;
		} else if (action === "uninstall") {
			command = `winget uninstall --id ${packageId}`;
		} else if (action === "upgrade") {
			command = `winget upgrade --id ${packageId}`;
		} else {
			return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}

		const { stdout, stderr } = await execAsync(command, {
			shell: "powershell.exe",
		});

		return NextResponse.json({
			success: true,
			output: stdout,
			error: stderr,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Unknown package action error";
		console.error("Package action error:", error);
		return NextResponse.json(
			{
				success: false,
				error: message,
			},
			{ status: 500 },
		);
	}
}
