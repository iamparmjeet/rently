import {
	DIGITAL_PAYMENT_METHODS,
	PAYMENT_METHODS,
} from "@rently/db/constants/payment-constants";
import { USER_ROLES, type UserRole } from "@rently/db/constants/user-roles";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";

const METHOD_LABELS: Record<string, string> = {
	upi: "UPI",
	cash: "Cash",
	bank_transfer: "Bank Transfer",
	cheque: "Cheque",
	online: "Online",
};

interface PaymentMethodSelectProps {
	role: UserRole;
	value: string | undefined;
	onChange: (value: string | null) => void;
}

export function PaymentMethodSelect({
	onChange,
	role,
	value,
}: PaymentMethodSelectProps) {
	// Filter at render time - tenant never sees cash/cheque as options
	const availableMethods =
		role === USER_ROLES.OWNER
			? Object.values(PAYMENT_METHODS)
			: DIGITAL_PAYMENT_METHODS;

	return (
		<Select
			value={value}
			onValueChange={(value, _eventDetails) => {
				if (value === null) return;
				onChange(value);
			}}
		>
			<SelectTrigger>
				<SelectValue placeholder="How was it paid?" />
			</SelectTrigger>
			<SelectContent>
				{availableMethods.map((method) => (
					<SelectItem key={method} value={method}>
						{METHOD_LABELS[method]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
