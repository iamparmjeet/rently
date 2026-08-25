"use client";

import { Button } from "@rently/ui/components/button";
import { NotFoundState } from "@rently/ui/shared/not-found-state";
import { PageLoader } from "@rently/ui/shared/page-loader";
import { RentReceipt } from "@rently/ui/shared/rent-receipt";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef } from "react";
import { useMyPaymentReceipt } from "@/hooks/tenant-portal";

export default function TenantPaymentReceiptPage({
	params,
}: {
	params: Promise<{ paymentId: string }>;
}) {
	const { paymentId } = use(params);
	const searchParams = useSearchParams();
	const router = useRouter();
	const { data, isError, isLoading } = useMyPaymentReceipt(paymentId);
	const printed = useRef(false);
	const shouldPrint = searchParams.get("print") === "true";

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset printed on paymentId change
	useEffect(() => {
		printed.current = false;
	}, [paymentId]);

	useEffect(() => {
		if (!shouldPrint || !data?.receipt || printed.current) return;

		printed.current = true;
		let cancelled = false;
		const doPrint = async () => {
			try {
				if (document.fonts?.ready) await document.fonts.ready;
			} catch {}
			if (cancelled) return;
			window.requestAnimationFrame(() => {
				if (!cancelled) window.print();
			});
		};
		const timer = window.setTimeout(doPrint, 100);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [data?.receipt, shouldPrint]);

	if (isLoading) return <PageLoader rows={2} />;

	if (isError || !data?.receipt) {
		return <NotFoundState message="Receipt not found or unavailable." />;
	}

	return (
		<main className="rent-receipt-page min-h-screen bg-slate-100 px-4 py-6 sm:px-8 sm:py-10">
			<style>{`
				@media print {
					body:has(.rent-receipt-page) .receipt-screen-only {
						display: none !important;
					}

					body:has(.rent-receipt-page) main {
						min-height: 0 !important;
						padding: 0 !important;
					}
				}
			`}</style>

			<div className="receipt-screen-only mx-auto mb-4 flex w-full max-w-210 justify-between gap-3">
				<Button
					variant="outline"
					onClick={() => {
						if (window.history.length > 1) window.history.back();
						else router.push("/");
					}}
				>
					<IconArrowLeft className="size-4" />
					Back to payments
				</Button>
				<Button onClick={() => window.print()}>
					<IconPrinter className="size-4" />
					Print / Save PDF
				</Button>
			</div>

			<RentReceipt receipt={data.receipt} />
		</main>
	);
}
