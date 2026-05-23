export interface TenantLeaseInfo {
	id: string;
	unitNumber: string;
	propertyName: string;
	startDate: Date;
	endDate: Date | null;
	rent: number; // in rupees
	deposit: number | null;
	status: "active" | "expired" | "terminated";
}

export interface TenantPaymentRecord {
	id: string;
	amount: number;
	paidAt: Date;
	method: string;
	status: "paid" | "pending" | "overdue";
}

// Props for each card
export interface TenantLeaseCardProps {
	lease: TenantLeaseInfo | null;
	isLoading: boolean;
}

export interface TenantRentDueCardProps {
	nextDueDate: Date | null;
	amount: number | null;
	isLoading: boolean;
}
