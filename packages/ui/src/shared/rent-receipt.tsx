import { formatRupees, rupeesToWords } from "@rently/ui/lib/currency";
import type { PaymentReceiptData } from "@rently/validators";
import { LogoIcon } from "./logo";

function formatDate(value: Date): string {
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: "Asia/Kolkata",
		day: "2-digit",
		month: "long",
		year: "numeric",
	}).format(value);
}

function paymentTypeLabel(type: string): string {
	return type.charAt(0).toUpperCase() + type.slice(1);
}

function paymentMethodLabel(method: string | null): string {
	return method ? method.replaceAll("_", " ").toUpperCase() : "—";
}

function Detail({
	label,
	value,
}: {
	label: string;
	value: string | null | undefined;
}) {
	return (
		<div className="space-y-1">
			<dt className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
				{label}
			</dt>
			<dd className="text-slate-900 text-sm">{value || "—"}</dd>
		</div>
	);
}

export function RentReceipt({ receipt }: { receipt: PaymentReceiptData }) {
	const issuer = receipt.owner.companyName || receipt.owner.name;

	return (
		<article className="rent-receipt mx-auto w-full max-w-210 bg-white p-6 text-slate-900 shadow-sm sm:p-10">
			<style>{`
				@page {
					size: A4;
					margin: 12mm;
				}

				@media print {
					html,
					body {
						background: #fff !important;
					}

					.rent-receipt {
						max-width: none !important;
						padding: 0 !important;
						box-shadow: none !important;
					}

					.rent-receipt .keyhq-logo-piece {
						animation: none !important;
						transform: none !important;
					}

					.receipt-screen-only {
						display: none !important;
					}
				}
			`}</style>

			<header className="flex items-start justify-between gap-6 border-slate-900 border-b-2 pb-6">
				<div>
					<div className="flex items-center gap-2">
						<LogoIcon aria-hidden="true" className="size-8.5 shrink-0" />
						<p className="font-bold text-xl tracking-tight">KeyHQ</p>
					</div>
					<p className="mt-1 text-slate-500 text-sm">
						Property Management Simplified
					</p>
				</div>

				<div className="text-right">
					<h1 className="font-extrabold text-2xl tracking-tight">
						RENT RECEIPT
					</h1>
					<p className="mt-2 font-mono text-slate-600 text-xs">
						{receipt.receiptNumber}
					</p>
				</div>
			</header>

			<section className="grid gap-8 border-slate-200 border-b py-6 sm:grid-cols-2">
				<div>
					<p className="mb-2 font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
						Received from
					</p>
					<p className="font-bold text-base">{receipt.tenant.name}</p>
					{receipt.tenant.address && (
						<p className="mt-1 whitespace-pre-line text-slate-600 text-sm">
							{receipt.tenant.address}
						</p>
					)}
				</div>

				<div className="sm:text-right">
					<p className="mb-2 font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
						Received by
					</p>
					<p className="font-bold text-base">{issuer}</p>
					{receipt.owner.companyName && (
						<p className="text-slate-600 text-sm">{receipt.owner.name}</p>
					)}
					{receipt.owner.address && (
						<p className="mt-1 whitespace-pre-line text-slate-600 text-sm">
							{receipt.owner.address}
						</p>
					)}
					{receipt.owner.gstNumber && (
						<p className="mt-1 text-slate-600 text-sm">
							GSTIN: {receipt.owner.gstNumber}
						</p>
					)}
				</div>
			</section>

			<section className="grid gap-4 border-slate-200 border-b py-6 sm:grid-cols-2">
				<Detail
					label="Property"
					value={`${receipt.property.name}, ${receipt.property.address}`}
				/>
				<Detail label="Unit" value={receipt.unit.unitNumber} />
				<Detail label="Lease ID" value={receipt.lease.id} />
				<Detail
					label="Payment date"
					value={formatDate(receipt.payment.paymentDate)}
				/>
			</section>

			<section className="py-6">
				<div className="overflow-hidden rounded-lg border border-slate-200">
					<div className="grid grid-cols-[1fr_auto] gap-4 bg-slate-50 px-4 py-3 font-semibold text-xs uppercase tracking-wide">
						<span>Payment details</span>
						<span>Amount</span>
					</div>

					{receipt.allocations && receipt.allocations.length > 1 ? (
						<div className="divide-y divide-slate-100">
							{receipt.allocations.map((allocation) => (
								<div
									key={allocation.leaseId}
									className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3"
								>
									<span className="font-semibold text-sm">
										Unit {allocation.unitNumber}
									</span>
									<span className="font-bold tabular-nums">
										{formatRupees(allocation.amount)}
									</span>
								</div>
							))}
							<div className="flex justify-between bg-slate-50 px-4 py-3 font-bold text-sm">
								<span>Total received</span>
								<span>{formatRupees(receipt.payment.amount)}</span>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-4">
							<div className="space-y-1">
								<p className="font-semibold text-sm">
									{paymentTypeLabel(receipt.payment.type)}
								</p>
								<p className="text-slate-600 text-sm">
									Method: {paymentMethodLabel(receipt.payment.paymentMethods)}
								</p>
								{receipt.payment.referenceNumber && (
									<p className="text-slate-600 text-sm">
										Reference: {receipt.payment.referenceNumber}
									</p>
								)}
								{receipt.payment.description && (
									<p className="text-slate-600 text-sm">
										{receipt.payment.description}
									</p>
								)}
							</div>

							<p className="font-bold text-lg tabular-nums">
								{formatRupees(receipt.payment.amount)}
							</p>
						</div>
					)}
				</div>

				<div className="mt-4 rounded-md bg-slate-50 px-4 py-3">
					<p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
						Amount in words
					</p>
					<p className="mt-1 font-medium text-sm">
						{rupeesToWords(receipt.payment.amount)}
					</p>
				</div>
			</section>

			<footer className="grid gap-8 border-slate-200 border-t pt-10 sm:grid-cols-2">
				<div>
					<div className="mb-2 h-px w-48 bg-slate-400" />
					<p className="text-slate-500 text-xs">Authorised signature</p>
				</div>

				<p className="text-slate-500 text-xs sm:text-right">
					This is a computer-generated receipt from KeyHQ.
				</p>
			</footer>
		</article>
	);
}
