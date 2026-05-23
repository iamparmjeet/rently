"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";

// ── Schema ───────────────────────────────────────────────────────────────────
const SetPasswordSchema = z
	.object({
		newPassword: z
			.string()
			.min(8, { error: "Password must be at least 8 characters" }),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		error: "Passwords do not match",
		path: ["confirmPassword"],
	});

type SetPasswordFormValues = z.infer<typeof SetPasswordSchema>;

interface SetPasswordFormProps {
	token: string;
}

export function SetPasswordForm({ token }: SetPasswordFormProps) {
	const router = useRouter();
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

		toast.success("Password set! You can now log in.");
		router.push("/login");
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
