"use client";

import {
	AlertCircle,
	CheckCircle,
	Database,
	Download,
	Loader2,
	Upload,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export default function BackupPage() {
	const [loading, setLoading] = useState(false);
	const [restorePath, setRestorePath] = useState("");
	const [backupPath, setBackupPath] = useState("");
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const handleBackup = async () => {
		try {
			setLoading(true);
			setMessage(null);

			const requestBody = backupPath.trim()
				? { backupPath: backupPath.trim() }
				: {};

			const res = await fetch("/api/backup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});

			const data = await res.json();

			if (data.success) {
				const location = backupPath.trim() || "%LOCALAPPDATA%\\winstro-backups";
				setMessage({
					type: "success",
					text: `Backup created successfully! Check ${location} folder.`,
				});
				setBackupPath("");
			} else {
				setMessage({
					type: "error",
					text: data.error || "Failed to create backup",
				});
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Failed to create backup";
			setMessage({ type: "error", text: message });
		} finally {
			setLoading(false);
		}
	};

	const handleRestore = async () => {
		try {
			setLoading(true);
			setMessage(null);

			const requestBody = restorePath.trim()
				? { backupPath: restorePath.trim() }
				: {};

			const res = await fetch("/api/restore", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});

			const data = await res.json();

			if (data.success) {
				const location =
					restorePath.trim() ||
					"the most recent backup from the default location";
				setMessage({
					type: "success",
					text: `Configurations restored successfully from ${location}!`,
				});
				setRestorePath("");
			} else {
				setMessage({
					type: "error",
					text: data.error || "Failed to restore backup",
				});
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Failed to restore backup";
			setMessage({ type: "error", text: message });
		} finally {
			setLoading(false);
		}
	};

	return (
		<TooltipProvider>
			<div className="space-y-8">
				<div>
					<h1 className="text-4xl font-bold tracking-tight">
						Backup & Restore
					</h1>
					<p className="text-muted-foreground mt-2">
						Backup your application configurations and restore them when needed.
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

				<Tabs defaultValue="backup">
					<TabsList>
						<TabsTrigger value="backup">
							<Database className="h-4 w-4 mr-2" />
							Backup
						</TabsTrigger>
						<TabsTrigger value="restore">
							<Upload className="h-4 w-4 mr-2" />
							Restore
						</TabsTrigger>
					</TabsList>

					<TabsContent value="backup" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle>Create Backup</CardTitle>
								<CardDescription>
									Backup all your application configurations to a compressed
									archive. This includes settings from various applications
									installed on your system.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="rounded-lg border p-4 space-y-2">
									<h4 className="font-medium text-sm">What gets backed up?</h4>
									<ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
										<li>Application configuration files</li>
										<li>User preferences and settings</li>
										<li>Custom keybindings and themes</li>
										<li>Browser bookmarks and extensions</li>
									</ul>
								</div>

								<div className="space-y-2">
									<Label htmlFor="backup-path">
										Custom Backup Path (Optional)
									</Label>
									<Input
										id="backup-path"
										placeholder="Leave empty for default location (%LOCALAPPDATA%\winstro\backups)"
										value={backupPath}
										onChange={(e) => setBackupPath(e.target.value)}
									/>
									<p className="text-xs text-muted-foreground">
										Enter a custom path or leave empty to use the default
										location
									</p>
								</div>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											onClick={handleBackup}
											disabled={loading}
											className="w-full cursor-pointer"
											size="lg"
										>
											{loading ? (
												<>
													<Loader2 className="h-5 w-5 mr-2 animate-spin" />
													Creating Backup...
												</>
											) : (
												<>
													<Download className="h-5 w-5 mr-2" />
													Create Backup Now
												</>
											)}
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>
											Create a backup of all your application configurations
										</p>
									</TooltipContent>
								</Tooltip>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="restore" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle>Restore from Backup</CardTitle>
								<CardDescription>
									Restore your configurations from a previously created backup
									file.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="backup-path">
										Backup File Path (Optional)
									</Label>
									<Input
										id="backup-path"
										placeholder="Leave empty to restore from most recent backup in default location"
										value={restorePath}
										onChange={(e) => setRestorePath(e.target.value)}
									/>
									<p className="text-xs text-muted-foreground">
										Enter a custom path or leave empty to use the most recent
										backup from %LOCALAPPDATA%\winstro-backups
									</p>
								</div>

								<Alert>
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>
										<strong>Warning:</strong> Restoring will overwrite your
										current configurations. Make sure you have a recent backup
										before proceeding.
									</AlertDescription>
								</Alert>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											onClick={handleRestore}
											disabled={loading}
											className="w-full cursor-pointer"
											size="lg"
										>
											{loading ? (
												<>
													<Loader2 className="h-5 w-5 mr-2 animate-spin" />
													Restoring...
												</>
											) : (
												<>
													<Upload className="h-5 w-5 mr-2" />
													Restore from Backup
												</>
											)}
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>
											Restore your configurations from the selected backup file
										</p>
									</TooltipContent>
								</Tooltip>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</TooltipProvider>
	);
}
