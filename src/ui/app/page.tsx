"use client";

import { Database, Package, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function Home() {
	const [stats, setStats] = useState({
		installedPackages: 0,
		configuredApps: 0,
		lastBackup: "Never",
	});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchStats = async () => {
			try {
				// Fetch from cache for faster dashboard load
				const [packagesRes, configRes] = await Promise.all([
					fetch("/api/packages"),
					fetch("/api/config"),
				]);

				const [packagesData, configData] = await Promise.all([
					packagesRes.json(),
					configRes.json(),
				]);

				setStats({
					installedPackages: packagesData.packages?.length || 0,
					configuredApps: configData.packages?.length || 0,
					lastBackup: "Not available",
				});
			} catch (error) {
				console.error("Failed to fetch stats:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, []);

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground mt-2">
					Windows as a distro. Manage your packages and configurations.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Installed Packages
						</CardTitle>
						<Package className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{loading ? "..." : stats.installedPackages}
						</div>
						<p className="text-xs text-muted-foreground">
							Total packages via winget
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Configured Apps
						</CardTitle>
						<Settings className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{loading ? "..." : stats.configuredApps}
						</div>
						<p className="text-xs text-muted-foreground">
							Apps in requirements.winget.ts
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Last Backup</CardTitle>
						<Database className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{stats.lastBackup}</div>
						<p className="text-xs text-muted-foreground">
							Configuration backup status
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
						<CardDescription>
							Common tasks for managing your system
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						<Button className="w-full" asChild>
							<a href="/packages">Browse & Install Packages</a>
						</Button>
						<Button className="w-full" variant="outline" asChild>
							<a href="/cli">Launch CLI Mode</a>
						</Button>
						<Button className="w-full" variant="outline" asChild>
							<a href="/backup">Backup Configurations</a>
						</Button>
						<Button className="w-full" variant="outline" asChild>
							<a href="/config">Update Configuration</a>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>About winstro</CardTitle>
						<CardDescription>
							Windows package management made simple
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="space-y-1">
							<p className="text-sm font-medium">Features</p>
							<ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
								<li>Install packages via winget</li>
								<li>Launch native CLI workflows</li>
								<li>Backup application configurations</li>
								<li>Restore from backups</li>
								<li>Generate config from installed apps</li>
							</ul>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
