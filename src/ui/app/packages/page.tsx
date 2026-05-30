"use client";

import { Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export default function PackagesPage() {
	const [packages, setPackages] = useState<Package[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const fetchPackages = useCallback(async (skipCache = false) => {
		try {
			setLoading(true);
			const url = skipCache ? "/api/packages?skipCache=true" : "/api/packages";
			const res = await fetch(url);
			const data = await res.json();
			setPackages(data.packages || []);

			// Show info if using cached data
			if (data.cached && !data.stale) {
				// Silently use cache
			} else if (data.stale) {
				setMessage({
					type: "error",
					text: `Using cached data. ${data.error || ""}`,
				});
			}
		} catch (error) {
			console.error("Failed to fetch packages:", error);
			setMessage({ type: "error", text: "Failed to load packages" });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchPackages();
	}, [fetchPackages]);

	const handleAction = async (
		packageId: string,
		action: "install" | "uninstall" | "upgrade",
	) => {
		try {
			setActionLoading(packageId);
			setMessage(null);

			const res = await fetch("/api/packages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ packageId, action }),
			});

			const data = await res.json();

			if (data.success) {
				setMessage({
					type: "success",
					text: `Successfully ${action}ed ${packageId}`,
				});
				await fetchPackages();
			} else {
				setMessage({
					type: "error",
					text: data.error || `Failed to ${action} package`,
				});
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Failed to run package action";
			setMessage({ type: "error", text: message });
		} finally {
			setActionLoading(null);
		}
	};

	const filteredPackages = packages.filter(
		(pkg) =>
			pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			pkg.id.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<TooltipProvider>
			<div className="space-y-6">
				<div>
					<h1 className="text-4xl font-bold tracking-tight">
						Package Management
					</h1>
					<p className="text-muted-foreground mt-2">
						Browse, install, and manage Windows packages via winget.
					</p>
				</div>

				{message && (
					<Alert variant={message.type === "error" ? "destructive" : "default"}>
						<AlertDescription>{message.text}</AlertDescription>
					</Alert>
				)}

				<div className="flex items-center gap-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search packages..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
						/>
					</div>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								onClick={() => fetchPackages(true)}
								variant="outline"
								disabled={loading}
								className="cursor-pointer"
							>
								<RefreshCw
									className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
								/>
								Refresh
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Reload package list from winget</p>
						</TooltipContent>
					</Tooltip>
				</div>

				{loading ? (
					<div className="space-y-4">
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
						<p className="text-center text-sm text-muted-foreground">
							Loading packages... This may take up to 30 seconds depending on
							your system.
						</p>
					</div>
				) : (
					<div>
						<p className="text-sm text-muted-foreground mb-4">
							{filteredPackages.length} packages installed
						</p>
						<ScrollArea className="h-150">
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
								{filteredPackages.map((pkg) => (
									<Card
										key={pkg.id}
										className="overflow-hidden flex flex-col hover:shadow-md transition-shadow"
									>
										<div className="flex flex-col p-4 flex-1 h-full">
											{/* Title and version row */}
											<div className="flex items-start justify-between mb-3">
												<h3 className="text-sm font-medium line-clamp-2 mb-1">
													{pkg.name}
												</h3>
												<Badge
													variant="secondary"
													className="text-xs px-2 py-0.5 ml-2"
												>
													{pkg.version}
												</Badge>
											</div>
											{/* Package ID */}
											<p className="text-xs text-muted-foreground line-clamp-1 mb-4">
												{pkg.id}
											</p>
											<div className="flex-1" />
											{/* Action buttons at bottom */}
											<div className="flex gap-2 w-full mt-auto">
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															size="sm"
															variant="outline"
															className="flex-1 cursor-pointer"
															onClick={() => handleAction(pkg.id, "upgrade")}
															disabled={actionLoading === pkg.id}
														>
															{actionLoading === pkg.id ? (
																<Loader2 className="h-3 w-3 animate-spin" />
															) : (
																<RefreshCw className="h-3 w-3" />
															)}
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														<p>Upgrade this package to the latest version</p>
													</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															size="sm"
															variant="destructive"
															className="flex-1 cursor-pointer"
															onClick={() => handleAction(pkg.id, "uninstall")}
															disabled={actionLoading === pkg.id}
														>
															{actionLoading === pkg.id ? (
																<Loader2 className="h-3 w-3 animate-spin" />
															) : (
																<Trash2 className="h-3 w-3" />
															)}
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														<p>Uninstall this package from your system</p>
													</TooltipContent>
												</Tooltip>
											</div>
										</div>
									</Card>
								))}
							</div>
						</ScrollArea>
					</div>
				)}
			</div>
		</TooltipProvider>
	);
}
