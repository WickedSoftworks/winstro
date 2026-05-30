import { type NextRequest, NextResponse } from "next/server";
import { runWinstroMain } from "@/lib/server/winstro-runtime";

export async function POST(request: NextRequest) {
	try {
		const { backupPath } = await request.json().catch(() => ({}));

		const envOverrides: Record<string, string> = {};
		if (backupPath?.trim()) {
			envOverrides.WINSTRO_RESTORE_PATH = backupPath.trim();
		}

		const { stdout, stderr } = await runWinstroMain(
			["--restore"],
			envOverrides,
		);

		return NextResponse.json({
			success: true,
			output: stdout,
			error: stderr,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Unknown restore error";
		console.error("Restore error:", error);
		return NextResponse.json(
			{
				success: false,
				error: message,
			},
			{ status: 500 },
		);
	}
}
