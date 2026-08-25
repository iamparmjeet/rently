"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GST_RATES } from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import {
	Field,
	FieldError,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import { Switch } from "@rently/ui/components/switch";
import type { UpsertOwnerProfileInput } from "@rently/validators";
import { UpsertOwnerProfileSchema } from "@rently/validators";
import { useForm } from "react-hook-form";
import { Container } from "@/components/shared/container";
import {
	useSuspenseOwnerProfile,
	useUpsertOwnerProfile,
} from "@/hooks/settings";

export function TaxGstTab() {
	const { data: profileData } = useSuspenseOwnerProfile();
	const { mutate: upsertProfile, isPending } = useUpsertOwnerProfile();

	const profile = profileData.profile;
	const hasGstNumber = Boolean(profile?.gstNumber?.trim());

	const form = useForm<UpsertOwnerProfileInput>({
		resolver: zodResolver(UpsertOwnerProfileSchema),
		values: {
			gstEnabled: profile?.gstEnabled ?? false,
			gstRateRent: (profile?.gstRateRent as number) ?? 0,
			gstRateMaintenance: (profile?.gstRateMaintenance as number) ?? 0,
		},
	});

	const gstEnabled = form.watch("gstEnabled") ?? false;

	function handleSubmit(values: UpsertOwnerProfileInput) {
		// preserve existing profile fields — only update GST slice
		upsertProfile({
			gstEnabled: values.gstEnabled,
			gstRateRent: values.gstRateRent,
			gstRateMaintenance: values.gstRateMaintenance,
		});
	}

	return (
		<Container className="w-full p-0 sm:max-w-180">
			<div className="space-y-6">
				<Card>
					<CardContent className="pt-6">
						<form onSubmit={form.handleSubmit(handleSubmit)}>
							<FieldSet className="space-y-6">
								<div>
									<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
										Tax & GST
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										GST config is owner-scoped. Rates apply to new bills only.
										Electricity/Water supply by owner is locked at 0% — not
										selectable.
									</p>
								</div>

								{profile?.gstNumber ? (
									<p className="rounded-md bg-muted px-3 py-2 font-mono text-muted-foreground text-xs">
										GSTIN: {profile.gstNumber}
									</p>
								) : (
									<p className="rounded-md bg-amber-50 px-3 py-2 text-amber-700 text-xs">
										Add GSTIN in Profile first to enable GST.
									</p>
								)}

								<Field>
									<div className="flex items-center justify-between gap-4 rounded-lg border p-4">
										<div className="space-y-1">
											<FieldLabel>Enable GST</FieldLabel>
											<p className="text-muted-foreground text-xs">
												{hasGstNumber
													? "Show GSTIN and HSN on bills and credit notes"
													: "Add GSTIN in Profile first"}
											</p>
										</div>
										<Switch
											checked={gstEnabled}
											disabled={!hasGstNumber}
											onCheckedChange={(v) => form.setValue("gstEnabled", v)}
										/>
									</div>
									<FieldError>
										{form.formState.errors.gstEnabled?.message}
									</FieldError>
								</Field>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<Field>
										<FieldLabel>Rent GST rate</FieldLabel>
										<Select
											value={String(form.watch("gstRateRent") ?? 0)}
											onValueChange={(v) =>
												form.setValue("gstRateRent", Number(v) as never)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select rate" />
											</SelectTrigger>
											<SelectContent>
												{GST_RATES.map((r) => (
													<SelectItem key={r} value={String(r)}>
														{r}% {r === 0 ? "(exempt — default)" : ""}
														{r === 18 ? " (commercial)" : ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="mt-1 text-muted-foreground text-xs">
											Residential 0% exempt; commercial 18%. Confirm with CA.
										</p>
										<FieldError>
											{form.formState.errors.gstRateRent?.message}
										</FieldError>
									</Field>

									<Field>
										<FieldLabel>Maintenance GST rate</FieldLabel>
										<Select
											value={String(form.watch("gstRateMaintenance") ?? 0)}
											onValueChange={(v) =>
												form.setValue("gstRateMaintenance", Number(v) as never)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select rate" />
											</SelectTrigger>
											<SelectContent>
												{GST_RATES.map((r) => (
													<SelectItem key={r} value={String(r)}>
														{r}% {r === 0 ? "(exempt)" : ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="mt-1 text-muted-foreground text-xs">
											Electricity/Water remain 0% — not affected.
										</p>
										<FieldError>
											{form.formState.errors.gstRateMaintenance?.message}
										</FieldError>
									</Field>
								</div>

								<p className="rounded-md border bg-slate-50 px-3 py-2 text-slate-500 text-xs">
									CA disclaimer: Rates shown as you configured. Residential
									renting is typically 0% exempt; confirm HSN/rate with your CA
									— KeyHQ shows what you set.
								</p>

								<div className="flex gap-3 pt-2">
									<Button type="submit" disabled={isPending}>
										{isPending ? "Saving..." : "Save GST settings"}
									</Button>
									<Button
										type="button"
										variant="ghost"
										onClick={() => form.reset()}
									>
										Cancel
									</Button>
								</div>
							</FieldSet>
						</form>
					</CardContent>
				</Card>
			</div>
		</Container>
	);
}
