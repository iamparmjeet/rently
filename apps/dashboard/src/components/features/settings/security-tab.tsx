// apps/dashboard/src/components/features/settings/security-tab.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { IconDeviceMobile, IconKey, IconShield } from "@tabler/icons-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

// ── Password change schema ───────────────────────────────────────────────────
const ChangePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		// WHY path: "confirmPassword" — Zod v4 .refine() attaches the error to
		// the field at this path, so RHF shows it under the right input.
		path: ["confirmPassword"],
	});
type ChangePasswordValues = z.infer<typeof ChangePasswordSchema>;

export function SecurityTab() {
	const [isRevokingAll, setIsRevokingAll] = useState(false);

	const form = useForm<ChangePasswordValues>({
		resolver: zodResolver(ChangePasswordSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	// ── Password change via Better Auth ─────────────────────────────────────
	async function handlePasswordChange(values: ChangePasswordValues) {
		try {
			// WHY authClient.changePassword: password state lives in the auth system
			// (Better Auth), not in our Drizzle tables. Never store or hash passwords
			// yourself — let the auth layer own that.
			await authClient.changePassword({
				currentPassword: values.currentPassword,
				newPassword: values.newPassword,
				revokeOtherSessions: false,
			});
			toast.success("Password updated successfully");
			form.reset();
		} catch (error) {
			toast.error("Failed to update password. Check your current password.");
			console.error(error); // TODO: remove before prod
		}
	}

	// ── Revoke all sessions except current ──────────────────────────────────
	async function handleRevokeAllSessions() {
		setIsRevokingAll(true);
		try {
			// WHY revokeOtherSessions: this is the "sign out all other devices"
			// pattern — keeps the current session active so the user isn't locked out.
			await authClient.revokeOtherSessions();
			toast.success("All other sessions revoked");
		} catch (error) {
			toast.error("Failed to revoke sessions");
			console.error(error); // TODO: remove before prod
		} finally {
			setIsRevokingAll(false);
		}
	}

	return (
		<div className="space-y-6">
			{/* ── Password ─────────────────────────────────────────────────────── */}
			<Card>
				<CardContent className="pt-6">
					<form onSubmit={form.handleSubmit(handlePasswordChange)}>
						<FieldSet className="space-y-4">
							<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
								Password
							</p>

							<Field>
								<FieldLabel>Current Password</FieldLabel>
								<Input
									{...form.register("currentPassword")}
									type="password"
									placeholder="Enter current password"
									autoComplete="current-password"
								/>
								<FieldError>
									{form.formState.errors.currentPassword?.message}
								</FieldError>
							</Field>

							<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel>New Password</FieldLabel>
									<Input
										{...form.register("newPassword")}
										type="password"
										placeholder="New password"
										autoComplete="new-password"
									/>
									<FieldError>
										{form.formState.errors.newPassword?.message}
									</FieldError>
								</Field>

								<Field>
									<FieldLabel>Confirm Password</FieldLabel>
									<Input
										{...form.register("confirmPassword")}
										type="password"
										placeholder="Confirm new password"
										autoComplete="new-password"
									/>
									<FieldError>
										{form.formState.errors.confirmPassword?.message}
									</FieldError>
								</Field>
							</FieldGroup>

							<div>
								<Button type="submit" disabled={form.formState.isSubmitting}>
									{form.formState.isSubmitting
										? "Updating..."
										: "Update Password"}
								</Button>
							</div>
						</FieldSet>
					</form>
				</CardContent>
			</Card>

			{/* ── Two-Factor Authentication ── */}
			<Card>
				<CardContent className="space-y-4 pt-6">
					<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
						Two-Factor Authentication
					</p>

					{/* Authenticator App row */}
					<div className="flex items-center justify-between border-border border-b py-3">
						<div className="flex items-start gap-3">
							<IconShield className="mt-0.5 size-5 text-muted-foreground" />
							<div>
								<p className="font-medium text-sm">Authenticator App</p>
								<p className="text-muted-foreground text-xs">
									Use Google Authenticator or Authy for 2FA
								</p>
							</div>
						</div>
						{/* TODO: wire Better Auth 2FA plugin (totp) when enabled in auth config */}
						<Button variant="outline" size="sm" disabled>
							Enable
						</Button>
					</div>

					{/* SMS Verification row */}
					<div className="flex items-center justify-between py-3">
						<div className="flex items-start gap-3">
							<IconDeviceMobile className="mt-0.5 size-5 text-muted-foreground" />
							<div>
								<p className="font-medium text-sm">SMS Verification</p>
								<p className="text-muted-foreground text-xs">
									Verify your phone number for account recovery
								</p>
							</div>
						</div>
						{/* TODO: wire phone verification when Better Auth phoneNumber plugin is enabled */}
						<Button variant="outline" size="sm" disabled>
							Add phone
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* ── Active Sessions ──────── */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex items-center justify-between">
						<div className="flex items-start gap-3">
							<IconKey className="mt-0.5 size-5 text-muted-foreground" />
							<div>
								<p className="font-medium text-sm">Active Sessions</p>
								<p className="text-muted-foreground text-xs">
									Sign out all other devices except this one
								</p>
							</div>
						</div>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleRevokeAllSessions}
							disabled={isRevokingAll}
						>
							{isRevokingAll ? "Revoking..." : "Revoke All"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
