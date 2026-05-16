"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useAcceptInvite } from "@/hooks/invite";

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
	phone: string;
	ownerName: string;
}

// Success State
function SuccessState() {
	return (
		<div className="flex flex-col items-center gap-4 py-8 text-center">
			<div className="flex size-16 items-center justify-center rounded-full bg-green-100">
				<IconCircleCheck className="size-8 text-green-600" />
			</div>
			<div>
				<h3 className="font-semibold text-lg">Account Created</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Your Rentwise account is ready. Please log in to continue.
				</p>
			</div>
			<Button className={"mt-2 w-full"}>
				<Link href="/login">Go to Login </Link>
			</Button>
		</div>
	);
}

// Locked Field
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
	phone,
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
		defaultValues: {
			phone: phone || "",
		},
	});

	function onSubmit(values: AcceptFormValues) {
		acceptInvite.mutate(
			{
				token, // from URL (server -> props)
				password: values.password,
				phone: values.phone || undefined,
			},
			{
				onSuccess: () => setIsSuccess(true),
			},
		);
	}

	if (isSuccess) return <SuccessState />;
	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			{/* Header Context - who invited them*/}
			<div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
				<p className="text-blue-800 text-sm">
					<strong>{ownerName}</strong> has invited you to manage your rental
					agreement on RentWise.
				</p>
			</div>

			{/* Locked fields — owner-entered, shown for confirmation only */}
			<LockedField label="Full Name" value={name} />
			<LockedField label="Email Address" value={email} />

			{/* Phone — editable even if pre-filled */}
			<Field>
				<Label htmlFor="phone">Phone Number</Label>
				<Input
					id="phone"
					type="tel"
					placeholder="+91 98989 98989"
					{...register("phone")}
					disabled={acceptInvite.isPending}
				/>
				{errors.phone && <FieldError>{errors.phone.message}</FieldError>}
			</Field>

			{/* password*/}
			<Field>
				<Label htmlFor="password">Password</Label>
				<div className="relative">
					<Input
						id="password"
						type={showPassword ? "text" : "password"}
						placeholder="Enter your strong password"
						{...register("password")}
						disabled={acceptInvite.isPending}
						className="pr-10"
					/>
					<button
						type="button"
						onClick={() => setShowPassword(!showPassword)}
						className="-trnslate-y-1/2 absolute top-1/2 right-3 cursor-pointer text-muted-foreground hover:text-foreground"
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
				{errors.password && <FieldError>{errors.password.message}</FieldError>}
			</Field>

			{/* confirm password*/}
			<Field>
				<Label htmlFor="confirmPassword">Confirm Password</Label>
				<div className="relative">
					<Input
						id="confirmPassword"
						type={showPassword ? "text" : "password"}
						placeholder="Enter your strong password"
						{...register("confirmPassword")}
						disabled={acceptInvite.isPending}
						className="pr-10"
					/>
					<button
						type="button"
						onClick={() => setShowConfirm(!showConfirm)}
						className="-trnslate-y-1/2 absolute top-1/2 right-3 cursor-pointer text-muted-foreground hover:text-foreground"
					>
						{showConfirm ? (
							<IconEyeOff className="size-4" />
						) : (
							<IconEye className="size-4" />
						)}
					</button>
				</div>
				<p className="text-muted-foreground text-xs">
					8+ characters with uppercase, lowercase, and a number
				</p>
				{errors.confirmPassword && (
					<FieldError>{errors.confirmPassword.message}</FieldError>
				)}
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
