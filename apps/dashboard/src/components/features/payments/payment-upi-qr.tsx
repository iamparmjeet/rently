"use client";

import { Button } from "@rently/ui/components/button";
import { IconDownload } from "@tabler/icons-react";
import QRCode from "react-qr-code";

interface UpiQrProps {
	upiId: string;
	payeeName: string;
	// Amount in RUPEES (not paise) — optional, makes the QR pre-filled
	amount?: number;
	note?: string;
}

// WHY: UPI deep link is a standard RFC.
// Format: upi://pay?pa={upi_id}&pn={name}&am={rupees}&tn={note}&cu=INR
function buildUpiLink({ upiId, payeeName, amount, note }: UpiQrProps): string {
	const params = new URLSearchParams({
		pa: upiId, // payee address (UPI ID)
		pn: payeeName, // payee name
		cu: "INR", // currency
	});
	if (amount !== undefined) params.set("am", amount.toFixed(2));
	if (note) params.set("tn", note); // transaction note

	return `upi://pay?${params.toString()}`;
}

export function UpiQr({ upiId, payeeName, amount, note }: UpiQrProps) {
	const upiLink = buildUpiLink({ upiId, payeeName, amount, note });

	function downloadQr() {
		const svg = document.getElementById("upi-qr-svg");
		if (!svg) return;
		const svgData = new XMLSerializer().serializeToString(svg);
		const blob = new Blob([svgData], { type: "image/svg+xml" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `upi-${upiId}.svg`;
		a.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="flex flex-col items-center gap-4 rounded-xl border p-6">
			<p className="text-muted-foreground text-sm">
				Scan with PhonePe, GPay, or Paytm
			</p>
			<div className="rounded-lg bg-white p-4">
				{/* WHY: QRCode needs a white background — transparent bg breaks some scanners */}
				<QRCode id="upi-qr-svg" value={upiLink} size={200} level="M" />
			</div>
			<div className="text-center">
				<p className="font-medium text-sm">{payeeName}</p>
				<p className="font-mono text-muted-foreground text-xs">{upiId}</p>
				{amount && (
					<p className="mt-1 font-semibold text-lg">
						₹{amount.toLocaleString("en-IN")}
					</p>
				)}
			</div>
			<Button variant="outline" size="sm" onClick={downloadQr}>
				<IconDownload className="mr-2 size-4" />
				Download QR
			</Button>
		</div>
	);
}
