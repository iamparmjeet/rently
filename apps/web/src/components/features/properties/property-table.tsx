// src/components/properties/PropertyTable.tsx
import Link from "next/link";
import type { PropertyWithUnits } from "@/types/property";

interface PropertyTableProps {
	properties: PropertyWithUnits[];
}

export function PropertyTable({ properties }: PropertyTableProps) {
	return (
		<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-b border-zinc-200 dark:border-zinc-800">
							<th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
								Property
							</th>
							<th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
								Type
							</th>
							<th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
								Units
							</th>
							<th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
								Occupancy
							</th>
							<th className="text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
								Revenue
							</th>
							<th className="text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
						{properties.map((property) => {
							const occupancy =
								property.total_units > 0
									? Math.round(
											(property.occupied_units / property.total_units) * 100,
										)
									: 0;

							return (
								<tr
									key={property.id}
									className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
								>
									<td className="px-4 py-4">
										<Link
											href={`/properties/${property.id}`}
											className="flex items-center gap-3 group"
										>
											<div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
												<PropertyTypeIcon type={property.type} />
											</div>
											<div>
												<p className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
													{property.name}
												</p>
												<p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">
													{property.address}
												</p>
											</div>
										</Link>
									</td>
									<td className="px-4 py-4">
										<span className="text-sm text-zinc-600 dark:text-zinc-400 capitalize">
											{property.type}
										</span>
									</td>
									<td className="px-4 py-4">
										<span className="text-sm text-zinc-900 dark:text-zinc-100">
											{property.occupied_units}/{property.total_units}
										</span>
									</td>
									<td className="px-4 py-4">
										<OccupancyBadge percent={occupancy} />
									</td>
									<td className="px-4 py-4 text-right">
										<span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
											{formatINR(property.monthly_revenue)}
										</span>
									</td>
									<td className="px-4 py-4">
										<div className="flex items-center justify-end gap-2">
											<Link
												href={`/properties/${property.id}/edit`}
												className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
											>
												<svg
													className="w-4 h-4"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
													/>
												</svg>
											</Link>
											<button className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
												<svg
													className="w-4 h-4"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</button>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{properties.length === 0 && <EmptyState />}
		</div>
	);
}

function PropertyTypeIcon({ type }: { type: string }) {
	if (type === "commercial") {
		return (
			<svg
				className="w-5 h-5 text-zinc-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		);
	}
	return (
		<svg
			className="w-5 h-5 text-zinc-400"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
			/>
		</svg>
	);
}

function OccupancyBadge({ percent }: { percent: number }) {
	const colorClass =
		percent >= 80
			? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
			: percent >= 50
				? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
				: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400";

	return (
		<span
			className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}
		>
			{percent}%
		</span>
	);
}

function EmptyState() {
	return (
		<div className="px-4 py-16 text-center">
			<svg
				className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
				/>
			</svg>
			<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
				No properties yet
			</h3>
			<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
				Get started by adding your first property.
			</p>
			<Link
				href="/properties/new"
				className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
			>
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add Property
			</Link>
		</div>
	);
}

function formatINR(amount: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}
