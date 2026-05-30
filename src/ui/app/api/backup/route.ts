import { type NextRequest, NextResponse } from "next/server";
import { runWinstroMain } from "@/lib/server/winstro-runtime";

export async function POST(request: NextRequest) {
	try {
		const { backupPath } = await request.json().catch(() => ({}));

		const envOverrides: Record<string, string> = {};
		if (backupPath) {
			envOverrides.WINSTRO_BACKUP_PATH = backupPath;
		}

		const { stdout, stderr } = await runWinstroMain(["--backup"], envOverrides);

		return NextResponse.json({
			success: true,
			output: stdout,
			error: stderr,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Unknown backup error";
		console.error("Backup error:", error);
		return NextResponse.json(
			{
				success: false,
				error: message,
			},
			{ status: 500 },
		);
	}
}
