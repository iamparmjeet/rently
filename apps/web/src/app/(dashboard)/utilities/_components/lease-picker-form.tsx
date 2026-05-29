// ─── Sub-components ──────

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import type { UtilityBatchFormValues } from "@rently/validators";
import { useState } from "react";
import { UtilityForm } from "@/components/forms/utility-form";

// WHY: Lease selection is a two-step UX — pick the lease, then fill the reading.
// This avoids a confusing form with a lease dropdown mixed in with numeric fields.
export function LeasePickerThenForm({
	leases,
	onSubmit,
	isSubmitting,
}: {
	leases: { id: string; unitId: string; tenantName: string | null }[];
	onSubmit: (v: UtilityBatchFormValues) => void;
	isSubmitting: boolean;
}) {
	const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

	if (!selectedLeaseId) {
		return (
			<div className="space-y-3">
				<p className="text-muted-foreground text-sm">
					Select the lease to record a reading for:
				</p>
				<Select onValueChange={setSelectedLeaseId}>
					<SelectTrigger>
						<SelectValue placeholder="Select active lease" />
					</SelectTrigger>
					<SelectContent>
						{leases.map((l) => (
							<SelectItem key={l.id} value={l.id}>
								{l.tenantName ? `${l.tenantName} . ${l.unitId}` : l.unitId}
								{/*{l.id.slice(0, 8)}...*/}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	}

	return (
		<UtilityForm
			leaseId={selectedLeaseId}
			onSubmit={onSubmit}
			isSubmitting={isSubmitting}
			submitLabel="Record Reading"
		/>
	);
}
