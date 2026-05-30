import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import {
	resolveRequirementsPath,
	runWinstroMain,
} from "@/lib/server/winstro-runtime";

function parseRequirements(content: string): string[] {
	const match = content.match(
		/const\s+winget_requirements(?:\s*:\s*string\[\])?\s*=\s*\[([\s\S]*?)\]/m,
	);

	if (!match) {
		return [];
	}

	return Array.from(match[1].matchAll(/["']([^"']+)["']/g))
		.map((entry) => entry[1].trim())
		.filter((entry) => entry.length > 0);
}

export async function GET() {
	try {
		const configPath = await resolveRequirementsPath();
		const content = await fs.readFile(configPath, "utf-8");
		const packages = parseRequirements(content);

		return NextResponse.json({ packages });
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Unknown config read error";
		console.error("Config GET error:", error);
		// Return empty array instead of error to prevent UI from breaking
		return NextResponse.json({ packages: [], error: message });
	}
}

export async function POST() {
	try {
		const { stdout, stderr } = await runWinstroMain(["--qwrite"]);

		return NextResponse.json({
			success: true,
			output: stdout,
			error: stderr,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Unknown config write error";
		console.error("Config POST error:", error);
		return NextResponse.json(
			{
				success: false,
				error: message,
			},
			{ status: 500 },
		);
	}
}
