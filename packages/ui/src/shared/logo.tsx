import { env } from "@rently/env/web";
import { type ComponentProps, useId } from "react";

export function LogoIcon({ className, ...props }: ComponentProps<"svg">) {
	const gradientId = useId();

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 512 512"
			role="img"
			aria-labelledby="title desc"
			className={className}
			{...props}
		>
			<title id="title">KeyHQ icon</title>
			<defs>
				<linearGradient
					id={gradientId}
					x1="48"
					y1="48"
					x2="464"
					y2="464"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0" stopColor="#2563EB" />
					<stop offset="0.52" stopColor="#4F46E5" />
					<stop offset="1" stopColor="#7C3AED" />
				</linearGradient>
			</defs>
			<g fill={`url(#${gradientId})`}>
				<rect
					className="keyhq-logo-piece keyhq-logo-piece-top-left"
					x="48"
					y="48"
					width="132"
					height="132"
					rx="10"
				/>
				<rect
					className="keyhq-logo-piece keyhq-logo-piece-bottom-left"
					x="48"
					y="332"
					width="132"
					height="132"
					rx="10"
				/>
				<path
					className="keyhq-logo-piece keyhq-logo-piece-upper-arm"
					d="M284 48H454a10 10 0 0 1 10 10v78a20 20 0 0 1-5.86 14.14L380.28 228H284l-68-86 68-94Z"
				/>

				<path
					className="keyhq-logo-piece keyhq-logo-piece-lower-arm"
					d="M284 284h96.28l77.86 77.86A20 20 0 0 1 464 376v78a10 10 0 0 1-10 10H284l-68-94 68-86Z"
				/>

				<rect
					className="keyhq-logo-piece keyhq-logo-piece-centre"
					x="216"
					y="216"
					width="64"
					height="64"
					rx="8"
				/>
			</g>
		</svg>
	);
}

export default function Logo({
	className,
	demo = false,
}: {
	className?: string;
	demo?: boolean;
}) {
	return (
		<a
			href={env.NEXT_PUBLIC_WEB_URL}
			className={`keyhq-logo flex items-center ${className ?? ""}`}
		>
			<LogoIcon aria-hidden="true" className="size-8.5 shrink-0" />
			<span className="font-extrabold text-xl tracking-tight">KeyHQ</span>
			{demo && (
				<span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 font-semibold text-[8px] text-white uppercase tracking-wide">
					Demo
				</span>
			)}
		</a>
	);
}
