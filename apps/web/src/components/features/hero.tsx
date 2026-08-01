import { ArrowRight } from "lucide-react";
import Link from "next/link";

function DashboardMockup() {
	return (
		<div className="relative z-1">
			<div
				className="overflow-hidden rounded-xl border border-border"
				style={{
					boxShadow:
						"0 40px 100px oklch(0.488 0.243 264.376 / 0.2), 0 12px 32px rgba(0,0,0,0.1)",
					transform: "perspective(1600px) rotateY(-7deg) rotateX(2.5deg)",
					transition: "transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)",
				}}
			>
				{/* Browser chrome */}
				<div className="flex items-center gap-2.5 border-border border-b bg-muted px-3.5 py-2.5">
					<div className="flex gap-1.25">
						<span className="size-2.75 rounded-full bg-[#ff5f57]" />
						<span className="size-2.75 rounded-full bg-[#febc2e]" />
						<span className="size-2.75 rounded-full bg-[#28c840]" />
					</div>
					<div className="flex flex-1 items-center gap-1.25 rounded-[5px] border border-border bg-white px-2.5 py-1 text-[11px] text-muted-foreground">
						<span className="text-[9px]">🔒</span>
						app.keyhq.app/dashboard
					</div>
				</div>

				{/* Dashboard shell */}
				<div className="flex h-92.5 bg-white">
					{/* Sidebar */}
					<div className="flex w-39.5 shrink-0 flex-col gap-0.5 border-border border-r bg-sidebar px-2.5 py-3.5">
						<div className="mb-2 flex items-center gap-1.5 px-2 py-1.5">
							<div className="h-4.75 w-4.75 shrink-0 rounded-lg bg-primary" />
							<span className="font-extrabold text-[11.5px] tracking-[-0.2px]">
								KeyHQ
							</span>
						</div>
						<div className="px-2 py-[10px_8px_4px] font-bold text-[8.5px] text-muted-foreground uppercase tracking-[0.6px]">
							Menu
						</div>
						{[
							{ label: "Dashboard", active: true },
							{ label: "Properties", active: false },
							{ label: "Tenants", active: false },
							{ label: "Payments", active: false },
						].map((item) => (
							<div
								key={item.label}
								className={`flex items-center gap-1.5 rounded-sm px-2 py-1.75 font-medium text-[11px] ${item.active ? "bg-primary text-white" : "text-muted-foreground"}`}
							>
								<div className="size-3.25 shrink-0 rounded-[2px] bg-current opacity-40" />
								{item.label}
							</div>
						))}
					</div>

					{/* Main */}
					<div className="flex flex-1 flex-col overflow-hidden">
						{/* Top bar */}
						<div className="flex h-12 shrink-0 items-center justify-between border-border border-b bg-white/85 px-3.5">
							<div className="flex items-center gap-1.25 rounded-sm border border-border bg-muted px-2.5 py-1.25 text-[10.5px] text-muted-foreground">
								<svg
									viewBox="0 0 24 24"
									className="h-2.75 w-2.75 fill-none stroke-current"
									strokeWidth={2}
								>
									<title>Search Properties</title>
									<circle cx="11" cy="11" r="8" />
									<line x1="21" y1="21" x2="16.65" y2="16.65" />
								</svg>
								Search properties, tenants...
							</div>
							<div className="flex size-6.5 items-center justify-center rounded-[6px] bg-primary font-bold text-[10px] text-white">
								R
							</div>
						</div>

						{/* Content */}
						<div className="overflow-hidden p-3.5">
							<div className="mb-0.5 font-bold text-[12.5px]">
								Good morning, Rahul{" "}
								<span className="font-normal text-[10.5px] text-muted-foreground">
									· Wed, 28 May 2025
								</span>
							</div>
							<div className="mb-2.75 text-[10px] text-muted-foreground">
								Here's your portfolio overview for today
							</div>

							{/* Stats */}
							<div className="mb-2.75 grid grid-cols-4 gap-1.75">
								{[
									{
										label: "Properties",
										value: "12",
										badge: "+2 new",
										color: "text-primary bg-primary/10",
									},
									{
										label: "Tenants",
										value: "48",
										badge: "Active",
										color: "text-success bg-success-bg",
									},
									{
										label: "Revenue",
										value: "₹2.4L",
										badge: "↑ 12%",
										color: "text-success bg-success-bg",
									},
									{
										label: "Occupancy",
										value: "87%",
										badge: "3 vacant",
										color: "text-warning bg-warning-bg",
									},
								].map((s) => (
									<div
										key={s.label}
										className="rounded-md border border-border bg-white p-[9px_8px]"
									>
										<div className="mb-0.75 font-medium text-[8.5px] text-muted-foreground">
											{s.label}
										</div>
										<div className="font-extrabold text-[16px] leading-none">
											{s.value}
										</div>
										<span
											className={`mt-0.75 inline-block rounded-[3px] px-1.25 py-px font-semibold text-[7.5px] ${s.color}`}
										>
											{s.badge}
										</span>
									</div>
								))}
							</div>

							{/* Charts */}
							<div className="grid grid-cols-2 gap-1.75">
								<div className="rounded-md border border-border bg-white p-[9px_10px]">
									<div className="mb-1.75 font-bold text-[9.5px]">
										Recent Properties
									</div>
									{[
										{
											name: "Koramangala Heights",
											status: "Full",
											color: "text-success bg-success-bg",
										},
										{
											name: "Indiranagar Villa",
											status: "1 vacant",
											color: "text-warning bg-warning-bg",
										},
										{
											name: "HSR Layout Flats",
											status: "Full",
											color: "text-success bg-success-bg",
										},
									].map((p) => (
										<div
											key={p.name}
											className="flex items-center gap-1.5 border-border border-b py-1 last:border-0"
										>
											<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-muted">
												<div className="size-2.5 rounded-[1px] bg-muted-foreground/40" />
											</div>
											<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium text-[9.5px]">
												{p.name}
											</span>
											<span
												className={`shrink-0 rounded-[3px] px-1.25 py-px font-semibold text-[7.5px] ${p.color}`}
											>
												{p.status}
											</span>
										</div>
									))}
								</div>
								<div className="rounded-md border border-border bg-white p-[9px_10px]">
									<div className="mb-1.75 font-bold text-[9.5px]">
										Monthly Revenue
									</div>
									<div className="flex h-17 items-end gap-0.75">
										{[
											{ h1: "42%", h2: "28%", label: "Feb" },
											{ h1: "62%", h2: "38%", label: "Mar" },
											{ h1: "52%", h2: "33%", label: "Apr" },
											{ h1: "78%", h2: "48%", label: "May" },
											{ h1: "100%", h2: "60%", label: "Jun" },
										].map((bar) => (
											<div
												key={bar.label}
												className="flex flex-1 flex-col gap-0.5"
											>
												<div className="flex h-14 items-end gap-0.5">
													<div
														className="flex-1 rounded-t-[2px] bg-primary/90"
														style={{ height: bar.h1 }}
													/>
													<div
														className="flex-1 rounded-t-[2px]"
														style={{
															height: bar.h2,
															background: "oklch(0.65 0.1 200 / 0.4)",
														}}
													/>
												</div>
												<div className="text-center text-[7px] text-muted-foreground">
													{bar.label}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Floating badges */}
			<div
				className="absolute -right-5 -bottom-4.5 z-3 flex items-center gap-2.25 rounded-xl border border-border bg-white px-3.5 py-2.5"
				style={{ boxShadow: "0 8px 28px rgba(0,0,0,0.1)" }}
			>
				<div
					className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px]"
					style={{ background: "oklch(0.48 0.15 145 / 0.12)" }}
				>
					<svg
						viewBox="0 0 24 24"
						className="size-4.25 fill-none"
						style={{ stroke: "oklch(0.48 0.15 145)" }}
						strokeWidth={2}
					>
						<title>Revenue collected</title>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
				<div>
					<div className="font-extrabold text-[15px] leading-[1.1]">₹12Cr+</div>
					<div className="text-[11px] text-muted-foreground">
						Revenue collected
					</div>
				</div>
			</div>

			<div
				className="absolute top-8 -left-5.5 z-3 flex items-center gap-2.25 rounded-xl border border-border bg-white px-3.5 py-2.5"
				style={{ boxShadow: "0 8px 28px rgba(0,0,0,0.1)" }}
			>
				<div className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] bg-primary/10">
					<svg
						viewBox="0 0 24 24"
						className="size-4.25 fill-none stroke-primary"
						strokeWidth={2}
					>
						<title>Active tenants</title>
						<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
						<circle cx="9" cy="7" r="4" />
						<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
					</svg>
				</div>
				<div>
					<div className="font-extrabold text-[15px] leading-[1.1]">2,400+</div>
					<div className="text-[11px] text-muted-foreground">
						Active tenants
					</div>
				</div>
			</div>
		</div>
	);
}

export function Hero() {
	return (
		<section className="relative overflow-hidden pt-20 pb-0">
			{/* Background orbs */}
			<div
				className="pointer-events-none absolute -top-62.5 -right-50 z-0 h-175 w-175 rounded-full"
				style={{
					background: "oklch(0.488 0.243 264.376 / 0.1)",
					filter: "blur(110px)",
				}}
			/>
			<div
				className="pointer-events-none absolute bottom-0 -left-25 z-0 h-87.5 w-87.5 rounded-full"
				style={{
					background: "oklch(0.68 0.09 200 / 0.07)",
					filter: "blur(80px)",
				}}
			/>

			<div className="mx-auto max-w-300 px-7">
				<div className="grid grid-cols-1 items-center gap-16 pb-20 lg:grid-cols-2">
					{/* Left copy */}
					<div className="relative z-1">
						<div
							className="mb-6 inline-flex items-center gap-1.75 rounded-full border px-3.25 py-1.25 font-semibold text-[12.5px] text-primary"
							style={{
								background: "oklch(0.488 0.243 264.376 / 0.1)",
								borderColor: "oklch(0.488 0.243 264.376 / 0.2)",
							}}
						>
							<span className="size-1.5 shrink-0 rounded-full bg-primary" />
							Smart property management for India
						</div>

						<h1 className="text-balance font-extrabold text-[clamp(36px,3.8vw,54px)] leading-[1.08] tracking-[-1.8px]">
							Property Management,
							<br />
							<em className="text-primary not-italic">Simplified.</em>
						</h1>

						<p className="mt-5 max-w-112.5 text-pretty text-[17px] text-muted-foreground leading-[1.68]">
							KeyHQ helps landlords and property managers track tenants,
							automate rent collection, and manage utilities — all in one place.
						</p>

						<div className="mt-8.5 flex flex-wrap gap-3">
							<Link
								href="/register"
								className="inline-flex h-13.5 items-center gap-2 rounded-lg bg-primary px-9 font-semibold text-[16px] text-primary-foreground no-underline transition-all hover:bg-primary-hover"
							>
								Get Started Free
								<ArrowRight className="h-4 w-4" />
							</Link>
							<a
								href="#how-it-works"
								className="inline-flex h-13.5 items-center gap-2 rounded-lg border border-border bg-transparent px-9 font-semibold text-[16px] text-foreground no-underline transition-all hover:bg-muted"
							>
								See How It Works
							</a>
						</div>

						<div className="mt-9.5 flex items-center gap-3.5">
							<div className="flex">
								{[
									{
										initials: "RK",
										style: {
											background: "oklch(0.488 0.243 264.376 / 0.2)",
											color: "oklch(0.488 0.243 264.376)",
										},
									},
									{
										initials: "PM",
										style: {
											background: "oklch(0.72 0.12 210 / 0.25)",
											color: "oklch(0.42 0.12 210)",
										},
									},
									{
										initials: "AS",
										style: {
											background: "oklch(0.72 0.12 145 / 0.25)",
											color: "oklch(0.42 0.12 145)",
										},
									},
									{
										initials: "VN",
										style: {
											background: "oklch(0.72 0.12 30 / 0.25)",
											color: "oklch(0.52 0.12 30)",
										},
									},
								].map((av, i) => (
									<div
										key={i}
										className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white font-bold text-[10px]"
										style={{ ...av.style, marginRight: i < 3 ? "-9px" : "0" }}
									>
										{av.initials}
									</div>
								))}
							</div>
							<p className="ml-2.25 text-[13px] text-muted-foreground">
								<strong className="font-semibold text-foreground">
									2,400+ tenants
								</strong>{" "}
								actively managed across India
							</p>
						</div>
					</div>

					{/* Right: dashboard mockup */}
					<div className="hidden lg:block">
						<DashboardMockup />
					</div>
				</div>
			</div>
		</section>
	);
}
