import "@rently/env/web";
import type { NextConfig } from "next";

// const allowedDashboardOrigins = [
// 	"https://dashboard-rentwise.parmjeetmishra.com",
// 	"https://tenant-rentwise.parmjeetmishra.com",
// ];

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	transpilePackages: ["@rently/ui"],
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "lh3.googleusercontent.com" },
			{ protocol: "https", hostname: "github.com" },
		],
	},
	async headers() {
		return [
			{
				source: "/(login|register|forgot-password)(.*)",
				headers: [
					{
						key: "Access-Control-Allow-Origin",
						// value: allowedDashboardOrigins.join(", "),
						value: "*",
					},
					{
						key: "Access-Control-Allow-Methods",
						value: "GET, OPTIONS",
					},
					{
						key: "Access-Control-Allow-Headers",
						value:
							"Content-Type, RSC, Next-Router-Prefetch, Next-Router-State-Tree, Next-Url",
					},
					{
						key: "Access-Control-Allow-Credentials",
						value: "true",
					},
				],
			},
		];
	},
};

export default nextConfig;
