"use client";

import {
	AlertCircle,
	CheckCircle,
	Database,
	Loader2,
	Rocket,
	RotateCcw,
	Save,
	Settings,
	Terminal,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type CliMode = "interactive" | "headless" | "write" | "backup" | "restore";

type LaunchOption = {
	mode: CliMode;
	title: string;
	description: string;
	badge: string;
	icon: ComponentType<{ className?: string }>;
};

const launchOptions: LaunchOption[] = [
	{
		mode: "interactive",
		title: "Interactive CLI",
		description:
			"Launch the standard terminal menu with install/write/backup/restore options.",
		badge: "Default",
		icon: Terminal,
	},
	{
		mode: "headless",
		title: "Headless Install",
		description:
			"Run the package install flow directly from requirements without interactive prompts.",
		badge: "--headless",
		icon: Rocket,
	},
	{
		mode: "write",
		title: "Quick Write",
		description:
			"Launch the write flow to update requirements from currently installed packages.",
		badge: "--qwrite",
		icon: Save,
	},
	{
		mode: "backup",
		title: "Backup Mode",
		description: "Start CLI backup mode in a separate terminal window.",
		badge: "--backup",
		icon: Database,
	},
	{
		mode: "restore",
		title: "Restore Mode",
		description: "Start CLI restore mode in a separate terminal window.",
		badge: "--restore",
		icon: RotateCcw,
	},
];

export default function CliPage() {
	const [launchingMode, setLaunchingMode] = useState<CliMode | null>(null);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const launchCli = async (mode: CliMode) => {
		try {
			setLaunchingMode(mode);
			setMessage(null);

			const res = await fetch("/api/cli", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ mode }),
			});

			const data = await res.json();
			if (!data.success) {
				throw new Error(data.error || "Failed to launch CLI");
			}

			setMessage({
				type: "success",
				text: `CLI mode "${mode}" launched successfully in a separate terminal window.`,
			});
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Failed to launch CLI mode";
			setMessage({
				type: "error",
				text: message,
			});
		} finally {
			setLaunchingMode(null);
		}
	};

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-4xl font-bold tracking-tight">CLI Mode</h1>
				<p className="text-muted-foreground mt-2">
					Launch the native winstro CLI flows directly from the frontend.
				</p>
			</div>

			{message && (
				<Alert variant={message.type === "error" ? "destructive" : "default"}>
					{message.type === "success" ? (
						<CheckCircle className="h-4 w-4" />
					) : (
						<AlertCircle className="h-4 w-4" />
					)}
					<AlertDescription>{message.text}</AlertDescription>
				</Alert>
			)}

			<Card>
				<CardHeader>
					<CardTitle>CLI Launchers</CardTitle>
					<CardDescription>
						Each option opens a dedicated terminal process so you can use the
						exact CLI experience.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						{launchOptions.map((option) => {
							const Icon = option.icon;
							return (
								<div
									key={option.mode}
									className="rounded-lg border p-4 space-y-4"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<Icon className="h-4 w-4 text-muted-foreground" />
												<h3 className="font-medium">{option.title}</h3>
											</div>
											<p className="text-sm text-muted-foreground">
												{option.description}
											</p>
										</div>
										<Badge variant="secondary">{option.badge}</Badge>
									</div>

									<Button
										className="w-full"
										onClick={() => launchCli(option.mode)}
										disabled={launchingMode !== null}
									>
										{launchingMode === option.mode ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Launching...
											</>
										) : (
											<>
												<Settings className="h-4 w-4 mr-2" />
												Launch {option.title}
											</>
										)}
									</Button>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
