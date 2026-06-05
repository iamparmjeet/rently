"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { env } from "@rently/env/web";
import { Button } from "@rently/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";

// ── Schema ─────
const SetPasswordSchema = z
	.object({
		newPassword: z
			.string()
			.min(8, { error: "Password must be at least 8 characters" })
			.regex(/[A-Z]/, {
				error: "Must contain at least one uppercase letter",
			})
			.regex(/[a-z]/, {
				error: "Must contain at least one lowercase letter",
			})
			.regex(/[0-9]/, { error: "Must contain at least one number" }),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type SetPasswordFormValues = z.infer<typeof SetPasswordSchema>;

interface SetPasswordFormProps {
	token: string;
	role?: string;
}

export function SetPasswordForm({ token, role }: SetPasswordFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<SetPasswordFormValues>({
		resolver: zodResolver(SetPasswordSchema),
	});

	async function onSubmit(values: SetPasswordFormValues) {
		setIsSubmitting(true);

		// ⚠️ Better Auth client returns { data, error } — does NOT throw.
		// This is different from your oRPC client which throws on error.
		const { error } = await authClient.resetPassword({
			newPassword: values.newPassword,
			token,
		});

		if (error) {
			// Common cases: token expired, token already used, token not found
			toast.error(
				error.message ?? "Failed to set password. Request a new link.",
			);
			setIsSubmitting(false);
			return;
		}

		if (role === "owner") {
			window.location.href = `${env.NEXT_PUBLIC_DASHBOARD_URL}/dashboard`;
		} else {
			window.location.href = `${env.NEXT_PUBLIC_TENANT_URL}/tenant-portal`;
		}
		toast.success("Password set! You can now log in.");
		// router.push("/login" as Route);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<FieldSet>
				<FieldGroup className="flex flex-col gap-4">
					<Field data-invalid={!!errors.newPassword}>
						<FieldLabel htmlFor="newPassword">New Password</FieldLabel>
						<Input
							id="newPassword"
							type="password"
							placeholder="At least 8 characters"
							disabled={isSubmitting}
							{...register("newPassword")}
							aria-invalid={!!errors.newPassword}
						/>
						<FieldError errors={[errors.newPassword]} />
					</Field>

					<Field data-invalid={!!errors.confirmPassword}>
						<FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
						<Input
							id="confirmPassword"
							type="password"
							placeholder="Repeat your password"
							disabled={isSubmitting}
							{...register("confirmPassword")}
							aria-invalid={!!errors.confirmPassword}
						/>
						<FieldError errors={[errors.confirmPassword]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Setting password..." : "Set Password"}
			</Button>
		</form>
	);
}
