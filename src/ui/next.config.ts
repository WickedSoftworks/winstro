import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	poweredByHeader: false,
	productionBrowserSourceMaps: false,
	compress: true,
	outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
	experimental: {
		optimizePackageImports: ["lucide-react"],
	},
};

export default nextConfig;
