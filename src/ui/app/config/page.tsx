"use client";

import {
	AlertCircle,
	CheckCircle,
	FileText,
	Loader2,
	RefreshCw,
	Search,
	Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface Package {
	name: string;
	id: string;
	version: string;
}

export default function ConfigPage() {
	const [configuredPackages, setConfiguredPackages] = useState<string[]>([]);
	const [allPackages, setAllPackages] = useState<Package[]>([]);
	const [selectedPackages, setSelectedPackages] = useState<Set<string>>(
		new Set(),
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const fetchConfig = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch("/api/config");
			const data = await res.json();
			setConfiguredPackages(data.packages || []);
		} catch (error) {
			console.error("Failed to fetch config:", error);
			setMessage({ type: "error", text: "Failed to load configuration" });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchConfig();
	}, [fetchConfig]);

	const fetchAllPackages = async () => {
		try {
			// Use cached data for faster dialog opening
			const res = await fetch("/api/packages");
			const data = await res.json();
			setAllPackages(data.packages || []);

			// Show a subtle indicator if using cache
			if (data.cached && !data.stale) {
				// Data is from cache, which is fine for this use case
			}
		} catch (error) {
			console.error("Failed to fetch packages:", error);
			setMessage({ type: "error", text: "Failed to load packages" });
		}
	};

	const handleOpenDialog = async () => {
		setMessage(null);
		setSearchQuery("");
		await fetchAllPackages();
		setSelectedPackages(new Set(configuredPackages));
		setDialogOpen(true);
	};

	const togglePackage = (packageId: string) => {
		const newSelected = new Set(selectedPackages);
		if (newSelected.has(packageId)) {
			newSelected.delete(packageId);
		} else {
			newSelected.add(packageId);
		}
		setSelectedPackages(newSelected);
	};

	const handleSaveConfig = async () => {
		try {
			setSaving(true);
			setMessage(null);

			const res = await fetch("/api/config/save", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ packages: Array.from(selectedPackages) }),
			});

			const data = await res.json();

			if (data.success) {
				setMessage({
					type: "success",
					text: "Configuration file updated successfully!",
				});
				await fetchConfig();
				setDialogOpen(false);
			} else {
				setMessage({
					type: "error",
					text: data.error || "Failed to update configuration",
				});
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Failed to save configuration";
			setMessage({ type: "error", text: message });
		} finally {
			setSaving(false);
		}
	};

	const filteredPackages = allPackages.filter(
		(pkg) =>
			pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			pkg.id.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<TooltipProvider>
			<div className="space-y-8">
				<div>
					<h1 className="text-4xl font-bold tracking-tight">Configuration</h1>
					<p className="text-muted-foreground mt-2">
						Manage your winstro configuration file (requirements.winget.ts).
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

				<div className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Current Configuration</CardTitle>
							<CardDescription>
								Packages listed in config/requirements.winget.ts
							</CardDescription>
						</CardHeader>
						<CardContent>
							{loading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : (
								<>
									<div className="flex items-center justify-between mb-4">
										<div className="text-sm text-muted-foreground">
											{configuredPackages.length} packages configured
										</div>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													size="sm"
													variant="outline"
													onClick={fetchConfig}
													className="cursor-pointer"
												>
													<RefreshCw className="h-4 w-4 mr-2" />
													Refresh
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Reload configuration from file</p>
											</TooltipContent>
										</Tooltip>
									</div>
									<ScrollArea className="h-100">
										<div className="space-y-2">
											{configuredPackages.map((pkgId) => (
												<div
													key={pkgId}
													className="flex items-center justify-between rounded-lg border p-3"
												>
													<div className="space-y-1">
														<p className="text-sm font-medium leading-none">
															{pkgId}
														</p>
													</div>
													<Badge variant="secondary">
														<FileText className="h-3 w-3 mr-1" />
														Config
													</Badge>
												</div>
											))}
										</div>
									</ScrollArea>
								</>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Generate Configuration</CardTitle>
							<CardDescription>
								Update config file based on currently installed packages
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-lg border p-4 space-y-3">
								<h4 className="font-medium text-sm">How it works</h4>
								<ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
									<li>Scans all packages installed via winget</li>
									<li>Lets you select which packages to include</li>
									<li>Updates requirements.winget.ts with selections</li>
									<li>Persists your package configuration</li>
								</ol>
							</div>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										onClick={handleOpenDialog}
										className="w-full cursor-pointer"
										size="lg"
									>
										<Settings className="h-5 w-5 mr-2" />
										Select Packages to Configure
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>
										Open dialog to select which packages to include in
										configuration
									</p>
								</TooltipContent>
							</Tooltip>

							<div className="rounded-lg bg-muted p-4 space-y-2">
								<h4 className="font-medium text-sm">Configuration File</h4>
								<p className="text-xs text-muted-foreground font-mono">
									config/requirements.winget.ts
								</p>
							</div>
						</CardContent>
					</Card>
				</div>

				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
						<DialogHeader>
							<DialogTitle>Select Packages for Configuration</DialogTitle>
							<DialogDescription>
								Choose which packages to include in your requirements.winget.ts
								file
							</DialogDescription>
						</DialogHeader>

						<div className="flex flex-col space-y-4 flex-1 overflow-hidden">
							<div className="relative">
								<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search packages..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-10"
								/>
							</div>

							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">
									{selectedPackages.size} of {allPackages.length} packages
									selected
								</span>
								<div className="flex gap-2">
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												size="sm"
												variant="outline"
												className="cursor-pointer"
												onClick={() =>
													setSelectedPackages(
														new Set(allPackages.map((p) => p.id)),
													)
												}
											>
												Select All
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Select all packages</p>
										</TooltipContent>
									</Tooltip>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												size="sm"
												variant="outline"
												className="cursor-pointer"
												onClick={() => setSelectedPackages(new Set())}
											>
												Clear All
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Deselect all packages</p>
										</TooltipContent>
									</Tooltip>
								</div>
							</div>

							<ScrollArea className="h-[50vh] border rounded-lg">
								<div className="p-4 space-y-2">
									{filteredPackages.map((pkg) => (
										<Tooltip key={pkg.id}>
											<TooltipTrigger asChild>
												<div
													className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent cursor-pointer"
													onClick={() => togglePackage(pkg.id)}
												>
													<Checkbox
														checked={selectedPackages.has(pkg.id)}
														onCheckedChange={() => togglePackage(pkg.id)}
													/>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium truncate">
															{pkg.name}
														</p>
														<p className="text-xs text-muted-foreground truncate">
															{pkg.id}
														</p>
													</div>
													<Badge variant="secondary" className="text-xs">
														{pkg.version}
													</Badge>
												</div>
											</TooltipTrigger>
											<TooltipContent>
												<p>
													Click to{" "}
													{selectedPackages.has(pkg.id) ? "deselect" : "select"}{" "}
													this package
												</p>
											</TooltipContent>
										</Tooltip>
									))}
								</div>
							</ScrollArea>
						</div>

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setDialogOpen(false)}
								className="cursor-pointer"
							>
								Cancel
							</Button>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										onClick={handleSaveConfig}
										disabled={saving}
										className="cursor-pointer"
									>
										{saving ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Saving...
											</>
										) : (
											<>Save Configuration</>
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Save selected packages to requirements.winget.ts</p>
								</TooltipContent>
							</Tooltip>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</TooltipProvider>
	);
}
