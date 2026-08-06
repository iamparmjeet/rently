"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAcceptInvite } from "@rently/hooks";
import { Button } from "@rently/ui/components/button";
import { Field, FieldError } from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { Label } from "@rently/ui/components/label";
import { AcceptInviteSchema } from "@rently/validators";
import {
	IconCircleCheck,
	IconEye,
	IconEyeOff,
	IconLoader2,
	IconLock,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";

const acceptFormSchema = AcceptInviteSchema.omit({
	token: true,
})
	.extend({
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		path: ["confirmPassword"],
		error: "Passwords do not match",
	});

type AcceptFormValues = z.infer<typeof acceptFormSchema>;

interface AcceptInviteFormProps {
	token: string;
	name: string;
	email: string;
	ownerName: string;
	onboardingMode: "owner_prepared" | "tenant_completed";
	phone: string | null;
	address: string | null;
	emergencyContact: string | null;
	emergencyContactName: string | null;
	emergencyContactLocation: string | null;
}

function SuccessState() {
	return (
		<div className="flex flex-col items-center gap-4 py-8 text-center">
			<div className="flex size-16 items-center justify-center rounded-full bg-green-100">
				<IconCircleCheck className="size-8 text-green-600" />
			</div>
			<div>
				<h3 className="font-semibold text-lg">Account Created</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Your KeyHQ account is ready. Please log in to continue.
				</p>
			</div>
			<Button className="mt-2 w-full">
				<Link href={"/login" as Route}>Go to Login</Link>
			</Button>
		</div>
	);
}

function LockedField({ label, value }: { label: string; value: string }) {
	return (
		<Field>
			<Label className="flex items-center gap-1.5">
				{label}
				<span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
					<IconLock className="h-2.5 w-2.5" />
					Set by landlord
				</span>
			</Label>
			<Input
				value={value}
				disabled
				className="bg-muted/50 text-muted-foreground"
			/>
		</Field>
	);
}

export function AcceptInviteForm({
	token,
	name,
	email,
	ownerName,
	onboardingMode,
	phone,
	address,
	emergencyContact,
	emergencyContactName,
	emergencyContactLocation,
}: AcceptInviteFormProps) {
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);

	const acceptInvite = useAcceptInvite();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<AcceptFormValues>({
		resolver: zodResolver(acceptFormSchema),
	});

	function onSubmit(values: AcceptFormValues) {
		const { confirmPassword: _, ...acceptanceInput } = values;

		acceptInvite.mutate(
			{
				token,
				...acceptanceInput,
			},
			{
				onSuccess: () => setIsSuccess(true),
			},
		);
	}

	if (isSuccess) return <SuccessState />;

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
				<p className="text-blue-800 text-sm">
					<strong>{ownerName}</strong> has invited you to manage your rental
					agreement on KeyHQ.
				</p>
			</div>

			<LockedField label="Full Name" value={name} />
			<LockedField label="Email Address" value={email} />

			{onboardingMode === "owner_prepared" ? (
				<>
					{phone && <LockedField label="Phone Number" value={phone} />}
					{address && <LockedField label="Address" value={address} />}
					{emergencyContactName && (
						<LockedField
							label="Emergency Contact Name"
							value={emergencyContactName}
						/>
					)}
					{emergencyContact && (
						<LockedField
							label="Emergency Contact Phone"
							value={emergencyContact}
						/>
					)}
					{emergencyContactLocation && (
						<LockedField
							label="Emergency Contact Location"
							value={emergencyContactLocation}
						/>
					)}
				</>
			) : (
				<>
					<Field data-invalid={!!errors.phone}>
						<Label htmlFor="phone">Phone Number</Label>
						<Input
							id="phone"
							type="tel"
							placeholder="+91 98989 98989"
							{...register("phone")}
							disabled={acceptInvite.isPending}
						/>
						<FieldError errors={[errors.phone]} />
					</Field>

					<Field data-invalid={!!errors.address}>
						<Label htmlFor="address">Address</Label>
						<Input
							id="address"
							placeholder="Your current address"
							{...register("address")}
							disabled={acceptInvite.isPending}
						/>
						<FieldError errors={[errors.address]} />
					</Field>

					<Field data-invalid={!!errors.emergencyContactName}>
						<Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
						<Input
							id="emergencyContactName"
							placeholder="Full name"
							{...register("emergencyContactName")}
							disabled={acceptInvite.isPending}
						/>
						<FieldError errors={[errors.emergencyContactName]} />
					</Field>

					<Field data-invalid={!!errors.emergencyContact}>
						<Label htmlFor="emergencyContact">Emergency Contact Phone</Label>
						<Input
							id="emergencyContact"
							type="tel"
							placeholder="+91 98989 98989"
							{...register("emergencyContact")}
							disabled={acceptInvite.isPending}
						/>
						<FieldError errors={[errors.emergencyContact]} />
					</Field>

					<Field data-invalid={!!errors.emergencyContactLocation}>
						<Label htmlFor="emergencyContactLocation">
							Emergency Contact Location
						</Label>
						<Input
							id="emergencyContactLocation"
							placeholder="Relation and address"
							{...register("emergencyContactLocation")}
							disabled={acceptInvite.isPending}
						/>
						<FieldError errors={[errors.emergencyContactLocation]} />
					</Field>
				</>
			)}

			<Field data-invalid={!!errors.uidNumber}>
				<Label htmlFor="uidNumber">UID / Aadhaar Number</Label>
				<Input
					id="uidNumber"
					placeholder="1234 5678 9012"
					{...register("uidNumber")}
					disabled={acceptInvite.isPending}
				/>
				<p className="text-muted-foreground text-xs">
					Entered only by you and used for identity verification.
				</p>
				<FieldError errors={[errors.uidNumber]} />
			</Field>

			<Field data-invalid={!!errors.panNumber}>
				<Label htmlFor="panNumber">PAN Number</Label>
				<Input
					id="panNumber"
					placeholder="ABCDE1234F"
					{...register("panNumber")}
					disabled={acceptInvite.isPending}
				/>
				<FieldError errors={[errors.panNumber]} />
			</Field>

			<Field data-invalid={!!errors.password}>
				<Label htmlFor="password">Password</Label>
				<div className="relative">
					<Input
						id="password"
						type={showPassword ? "text" : "password"}
						placeholder="Enter a strong password"
						{...register("password")}
						disabled={acceptInvite.isPending}
						className="pr-10"
					/>
					<button
						type="button"
						onClick={() => setShowPassword((visible) => !visible)}
						className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
					>
						{showPassword ? (
							<IconEyeOff className="size-4" />
						) : (
							<IconEye className="size-4" />
						)}
					</button>
				</div>
				<p className="text-muted-foreground text-xs">
					8+ characters with uppercase, lowercase, and a number
				</p>
				<FieldError errors={[errors.password]} />
			</Field>

			<Field data-invalid={!!errors.confirmPassword}>
				<Label htmlFor="confirmPassword">Confirm Password</Label>
				<div className="relative">
					<Input
						id="confirmPassword"
						type={showConfirm ? "text" : "password"}
						placeholder="Confirm your password"
						{...register("confirmPassword")}
						disabled={acceptInvite.isPending}
						className="pr-10"
					/>
					<button
						type="button"
						onClick={() => setShowConfirm((visible) => !visible)}
						className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
					>
						{showConfirm ? (
							<IconEyeOff className="size-4" />
						) : (
							<IconEye className="size-4" />
						)}
					</button>
				</div>
				<FieldError errors={[errors.confirmPassword]} />
			</Field>

			<Field data-invalid={!!errors.termsAccepted}>
				<div className="flex items-start gap-2">
					<input
						id="termsAccepted"
						type="checkbox"
						className="mt-1 size-4"
						{...register("termsAccepted")}
						disabled={acceptInvite.isPending}
					/>
					<Label htmlFor="termsAccepted" className="font-normal text-sm">
						I agree to the{" "}
						<Link href="/terms" className="text-primary hover:underline">
							Terms of Service
						</Link>
						.
					</Label>
				</div>
				<FieldError errors={[errors.termsAccepted]} />
			</Field>

			<Field data-invalid={!!errors.privacyAcknowledged}>
				<div className="flex items-start gap-2">
					<input
						id="privacyAcknowledged"
						type="checkbox"
						className="mt-1 size-4"
						{...register("privacyAcknowledged")}
						disabled={acceptInvite.isPending}
					/>
					<Label htmlFor="privacyAcknowledged" className="font-normal text-sm">
						I acknowledge the{" "}
						<Link href="/privacy" className="text-primary hover:underline">
							Privacy Policy
						</Link>
						.
					</Label>
				</div>
				<FieldError errors={[errors.privacyAcknowledged]} />
			</Field>

			<Button
				type="submit"
				className="w-full"
				disabled={acceptInvite.isPending}
			>
				{acceptInvite.isPending ? (
					<>
						<IconLoader2 className="mr-2 size-4 animate-spin" />
						Creating account...
					</>
				) : (
					"Accept & Create Account"
				)}
			</Button>
		</form>
	);
}
