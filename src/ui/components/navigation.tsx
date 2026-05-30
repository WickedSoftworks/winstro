"use client";

import { Database, Home, Package, Settings, Terminal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function Navigation({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	const navigation = [
		{ name: "Dashboard", href: "/", icon: Home },
		{ name: "Packages", href: "/packages", icon: Package },
		{ name: "CLI Mode", href: "/cli", icon: Terminal },
		{ name: "Backup & Restore", href: "/backup", icon: Database },
		{ name: "Configuration", href: "/config", icon: Settings },
	];

	return (
		<div className="flex h-screen">
			{/* Sidebar */}
			<div className="w-64 border-r bg-card">
				<div className="flex h-16 items-center border-b px-6">
					<h1 className="text-2xl font-bold">winstro</h1>
				</div>
				<nav className="space-y-1 p-4">
					{navigation.map((item) => (
						<Link
							key={item.name}
							href={item.href}
							className={cn(
								"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
								pathname === item.href
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
							)}
						>
							<item.icon className="h-5 w-5" />
							{item.name}
						</Link>
					))}
				</nav>
			</div>

			{/* Main content */}
			<div className="flex-1 overflow-auto">
				<main className="p-8">{children}</main>
			</div>
		</div>
	);
}
