"use client";

import { useState } from "react";
import { useSubmitReading, useTenantUtilities } from "@/hooks/tenant-portal";
import { fmtDate, rupeesCompact } from "@/utils/format";

// 5-digit meter display — pads with leading zeros
function MeterDisplay({ value }: { value: string }) {
	const digits = value.replace(/\D/g, "").padStart(5, "0").slice(-5);
	return (
		<div className="flex items-center justify-center gap-1.5 rounded-lg bg-foreground p-5">
			{Array.from(digits).map((d, i) => (
				<div
					key={i}
					className="flex h-14 w-10 items-center justify-center rounded-md border border-zinc-600 bg-zinc-800 font-extrabold font-mono text-3xl text-amber-300"
				>
					{d}
				</div>
			))}
		</div>
	);
}

export function ReadingTab() {
	const { data, isLoading } = useTenantUtilities();
	const { mutate: submitReading, isPending, error } = useSubmitReading();

	const [currentInput, setCurrentInput] = useState("");
	const [readingDate, setReadingDate] = useState(() =>
		new Date().toISOString().slice(0, 10),
	);
	const [notes, setNotes] = useState("");

	const allUtilities = data?.utilities ?? [];
	// Latest electricity reading (first in desc-sorted array with type = electricity)
	const latestElec = allUtilities.find((u) => u.utilityType === "electricity");
	const electricReadings = allUtilities.filter(
		(u) => u.utilityType === "electricity",
	);

	const prevReading = latestElec?.currentReading ?? 0;
	// parseFloat keeps fractional meter readings (meters often have decimals)
	const currValue = Number.parseFloat(currentInput) || 0;

	const unitsConsumed = Math.max(0, currValue - prevReading);
	// Only estimate when owner rate is known — fallback 900/10000 is estimate only when no prior bill
	const hasRate =
		latestElec?.ratePerUnit != null && latestElec?.fixedCharge != null;
	const estimatePaise =
		currValue > prevReading && latestElec && hasRate
			? Math.round(
					unitsConsumed * (latestElec.ratePerUnit as number) +
						(latestElec.fixedCharge as number),
				)
			: currValue > prevReading && latestElec && !hasRate
				? Math.round(unitsConsumed * 900 + 10000) // fallback estimate when no prior rate
				: 0;

	const showEstimate = currValue > 0 && currValue > prevReading;

	function handleSubmit() {
		if (!currentInput) return;
		submitReading(
			{
				currentReading: currValue,
				readingDate,
				notes: notes || undefined,
			},
			{
				onSuccess: () => {
					setCurrentInput("");
					setNotes("");
				},
			},
		);
	}

	if (isLoading) {
		return <div className="h-80 animate-pulse rounded-xl bg-muted" />;
	}

	return (
		<div className="space-y-3.5">
			<div>
				<h1 className="font-extrabold text-xl">Add Electricity Reading</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Submit your current meter reading. Your landlord will receive it
					instantly.
				</p>
			</div>

			{/* Previous reading banner */}
			{latestElec && (
				<div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3.5">
					<p className="font-bold text-sm">Previous Reading</p>
					<div className="mt-1 flex justify-between text-sm">
						<span className="text-muted-foreground">
							{latestElec.currentReading?.toLocaleString("en-IN")} kWh
						</span>
						<span className="text-muted-foreground">
							{fmtDate(latestElec.currentReadingDate)}
						</span>
					</div>
				</div>
			)}

			{/* Input card */}
			<div className="space-y-4 rounded-xl border bg-background p-4">
				<p className="font-bold text-sm">Current Meter Reading</p>

				<MeterDisplay value={currentInput} />
				<p className="text-center text-muted-foreground text-xs">
					Display updates as you type
				</p>
				{error?.cause === "CONFLICT" && (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3.5 py-3 text-amber-600 text-sm">
						{error.message}
					</div>
				)}

				{error?.cause === "TOO_MANY_REQUESTS" && (
					<div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-3 text-destructive text-sm">
						{error.message}
					</div>
				)}

				{/* Reading input */}
				<div>
					<label
						className="mb-1.5 block font-semibold text-xs"
						htmlFor="curr-reading"
					>
						Enter reading (kWh)
					</label>
					<input
						id="curr-reading"
						type="number"
						inputMode="numeric"
						placeholder={`e.g. ${prevReading + 150}`}
						value={currentInput}
						onChange={(e) => setCurrentInput(e.target.value)}
						className="h-14 w-full rounded-lg border-2 border-primary bg-background text-center font-bold text-2xl text-primary outline-none transition-shadow focus:shadow-[0_0_0_4px] focus:shadow-primary/20"
					/>
				</div>

				{/* Date input */}
				<div>
					<label
						className="mb-1.5 block font-semibold text-xs"
						htmlFor="reading-date"
					>
						Reading Date
					</label>
					<input
						id="reading-date"
						type="date"
						value={readingDate}
						onChange={(e) => setReadingDate(e.target.value)}
						className="h-11 w-full rounded-lg border bg-background px-3 font-medium text-sm outline-none focus:border-primary"
					/>
				</div>

				{/* Live estimate */}
				{showEstimate && (
					<div className="rounded-lg bg-primary/10 px-3.5 py-3">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Units consumed</span>
							<span className="font-bold text-primary">
								{unitsConsumed} kWh
							</span>
						</div>
						<div className="mt-1.5 flex justify-between text-sm">
							<span className="text-muted-foreground">Estimated bill</span>
							<span className="font-bold text-emerald-600">
								{rupeesCompact(estimatePaise)}
							</span>
						</div>
					</div>
				)}

				{/* Notes */}
				<div>
					<label
						className="mb-1.5 block font-semibold text-xs"
						htmlFor="reading-notes"
					>
						Notes (optional)
					</label>
					<input
						id="reading-notes"
						type="text"
						placeholder="e.g. Meter checked at noon, power cut earlier..."
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
					/>
				</div>
			</div>

			{/* Actions */}
			<div className="flex gap-2.5">
				<button
					type="button"
					disabled={!currentInput || isPending}
					onClick={handleSubmit}
					className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary bg-primary font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isPending ? "Submitting…" : "Submit & Notify"}
				</button>
			</div>

			{/* Reading history */}
			<div className="rounded-xl border bg-background p-4">
				<p className="mb-3 font-bold text-sm">Reading History</p>
				{electricReadings.length === 0 ? (
					<p className="py-4 text-center text-muted-foreground text-sm">
						No previous readings.
					</p>
				) : (
					<div className="divide-y divide-border">
						{electricReadings.map((r) => (
							<div
								key={r.id}
								className="flex items-center justify-between py-3"
							>
								<div>
									<p className="font-semibold text-sm">
										{fmtDate(r.currentReadingDate)}
									</p>
									<p className="text-muted-foreground text-xs">
										Prev: {r.previousReading?.toLocaleString("en-IN") ?? "—"} →
										Curr: {r.currentReading?.toLocaleString("en-IN") ?? "—"} kWh
									</p>
								</div>
								<div className="text-right">
									<p className="font-bold text-primary">
										{r.unitsUsed ?? "—"} kWh
									</p>
									<p className="text-emerald-600 text-xs">
										{rupeesCompact(r.totalAmount)}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
