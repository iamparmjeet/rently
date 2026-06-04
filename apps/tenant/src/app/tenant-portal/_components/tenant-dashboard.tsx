// src/app/(tenant-portal)/tenant-portal/_components/tenant-dashboard.tsx
"use client";

import { TenantLeaseCard } from "./tenant-lease-card";
import { TenantRentDueCard } from "./tenant-rent-due-card";
import { TenantWelcomeCard } from "./tenant-welcome-card";

// TODO: Replace with real hook once tenant API procedures are built
// The hook will look like:
//   const { data, isLoading } = useTenantPortalData()
// which calls a server procedure that looks up the current session's tenant record
// and returns their active lease + next payment due date

export function TenantDashboard() {
	// TODO: wire to useTenantPortalData() when API is ready
	const isLoading = false;

	// TODO: remove mock data; replace with data?.lease
	const mockLease = {
		id: "lease-001",
		unitNumber: "3B",
		propertyName: "Sunrise Apartments",
		startDate: new Date("2024-01-01"),
		endDate: new Date("2024-12-31"),
		rent: 15000,
		deposit: 30000,
		status: "active" as const,
	};

	// TODO: remove mock data; replace with data?.nextDueDate / data?.nextAmount
	const mockNextDueDate = new Date(
		new Date().getFullYear(),
		new Date().getMonth(),
		// simulate due on the 1st of next month
		1 + 30,
	);

	return (
		<div className="space-y-6">
			{/* Welcome banner */}
			<TenantWelcomeCard
				unitNumber={mockLease.unitNumber}
				propertyName={mockLease.propertyName}
			/>

			{/* Two-column grid on larger screens */}
			<div className="grid gap-4 sm:grid-cols-2">
				<TenantRentDueCard
					nextDueDate={mockNextDueDate}
					amount={mockLease.rent}
					isLoading={isLoading}
				/>

				{/* Placeholder: recent payments — build in next session */}
				<div className="flex items-center justify-center rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
					Recent payment history
					<br />
					<span className="text-xs opacity-60">— coming next session —</span>
				</div>
			</div>

			{/* Full-width lease details */}
			<TenantLeaseCard lease={mockLease} isLoading={isLoading} />

			{/* Quick actions placeholder */}
			<div className="flex items-center justify-center rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
				Quick actions: Contact landlord · Download lease
				<br />
				<span className="text-xs opacity-60">— coming next session —</span>
			</div>
		</div>
	);
}
