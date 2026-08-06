import "@rently/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	transpilePackages: ["@rently/ui"],
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "lh3.googleusercontent.com" },
			{ protocol: "https", hostname: "github.com" },
			// WHY: owner avatars are stored in R2 and served via the public custom domain
			{ protocol: "https", hostname: "keyhq-media.parmjeetmishra.com" },
		],
	},
};

export default nextConfig;
