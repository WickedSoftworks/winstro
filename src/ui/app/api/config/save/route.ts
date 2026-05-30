import fs from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { packages } = await request.json();

		if (!Array.isArray(packages)) {
			return NextResponse.json(
				{ error: "Packages must be an array" },
				{ status: 400 },
			);
		}

		// Use the same config path resolution as smart_write.ts
		const configPath = path.join(
			process.cwd(),
			"../../config/requirements.winget.ts",
		);

		// Use the same formatting pattern as smart_write.ts
		const content = `const winget_requirements: string[] = ${JSON.stringify(packages, null, 2)};\nexport default winget_requirements;\n`;

		await fs.writeFile(configPath, content, "utf-8");

		return NextResponse.json({
			success: true,
			message: "Configuration updated successfully",
		});
	} catch (error: unknown) {
		console.error("Config save error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "An unknown error occurred";
		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: 500 },
		);
	}
}
