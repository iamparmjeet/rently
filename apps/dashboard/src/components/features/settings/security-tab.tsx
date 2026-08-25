// apps/dashboard/src/components/features/settings/security-tab.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@rently/ui/components/badge";
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
import {
	IconBrandGithub,
	IconBrandGoogle,
	IconDeviceMobile,
	IconDevices,
	IconKey,
	IconLink,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Container } from "@/components/shared/container";
import { authClient, useSession } from "@/lib/auth-client";

// ── Schemas ──────────────────────────────────────────────────────────────
const ChangePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});
type ChangePasswordValues = z.infer<typeof ChangePasswordSchema>;

const SetPasswordSchema = z
	.object({
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});
type SetPasswordValues = z.infer<typeof SetPasswordSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────
type LinkedAccount = {
	id: string;
	providerId: string;
	accountId: string;
	createdAt: string;
};

type SessionItem = {
	id: string;
	token: string;
	ipAddress?: string | null;
	userAgent?: string | null;
	createdAt: string | Date;
	expiresAt: string | Date;
	userId: string;
};

function parseUserAgent(ua?: string | null) {
	if (!ua) return "Unknown device";
	const lower = ua.toLowerCase();
	if (lower.includes("iphone") || lower.includes("ipad"))
		return "iPhone / iPad";
	if (lower.includes("android")) return "Android device";
	if (lower.includes("windows")) return "Windows";
	if (lower.includes("macintosh") || lower.includes("mac os")) return "macOS";
	if (lower.includes("linux")) return "Linux";
	return ua.slice(0, 60);
}

function formatDate(d: string | Date) {
	const date = new Date(d);
	return date.toLocaleString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function SecurityTab() {
	const { data: sessionData } = useSession();
	const currentToken = (
		sessionData as unknown as { session?: { token: string } }
	)?.session?.token;

	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [sessions, setSessions] = useState<SessionItem[]>([]);
	const [loadingAccounts, setLoadingAccounts] = useState(true);
	const [loadingSessions, setLoadingSessions] = useState(true);
	const [isRevokingAll, setIsRevokingAll] = useState(false);
	const [revokingToken, setRevokingToken] = useState<string | null>(null);
	const [linking, setLinking] = useState(false);
	const [unlinking, setUnlinking] = useState<string | null>(null);

	const hasGoogle = useMemo(
		() => accounts.some((a) => a.providerId === "google"),
		[accounts],
	);
	const hasGithub = useMemo(
		() => accounts.some((a) => a.providerId === "github"),
		[accounts],
	);
	const hasPassword = useMemo(
		() => accounts.some((a) => a.providerId === "credential"),
		[accounts],
	);
	// Fallback: if no credential account, treat as OAuth-only
	const isOAuthOnly = accounts.length > 0 && !hasPassword;

	const changeForm = useForm<ChangePasswordValues>({
		resolver: zodResolver(ChangePasswordSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});
	const setForm = useForm<SetPasswordValues>({
		resolver: zodResolver(SetPasswordSchema),
		defaultValues: { newPassword: "", confirmPassword: "" },
	});

	// ── Fetch linked accounts + sessions ─────────────────────────────────
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				// Flow: SecurityTab -> authClient -> Better Auth /list-accounts & /list-sessions
				// WHY: linked accounts live in `account` table, sessions in `session` table via drizzleAdapter
				const ac = authClient as unknown as {
					listAccounts?: () => Promise<{
						data: LinkedAccount[] | null;
						error: unknown;
					}>;
					listSessions?: () => Promise<{
						data: SessionItem[] | null;
						error: unknown;
					}>;
				};
				if (ac.listAccounts) {
					const res = await ac.listAccounts();
					if (!cancelled && res.data) setAccounts(res.data as LinkedAccount[]);
				} else {
					// fallback fetch
					const res = await fetch(
						`${process.env.NEXT_PUBLIC_SERVER_URL ?? ""}/api/auth/list-accounts`,
						{
							credentials: "include",
						},
					);
					if (res.ok) {
						const data = (await res.json()) as LinkedAccount[];
						if (!cancelled) setAccounts(Array.isArray(data) ? data : []);
					}
				}
			} catch {
				// non-fatal
			} finally {
				if (!cancelled) setLoadingAccounts(false);
			}
			try {
				const ac = authClient as unknown as {
					listSessions?: () => Promise<{
						data: SessionItem[] | null;
						error: unknown;
					}>;
				};
				if (ac.listSessions) {
					const res = await ac.listSessions();
					if (!cancelled && res.data) setSessions(res.data as SessionItem[]);
				} else {
					const res = await fetch(
						`${process.env.NEXT_PUBLIC_SERVER_URL ?? ""}/api/auth/list-sessions`,
						{
							credentials: "include",
						},
					);
					if (res.ok) {
						const data = (await res.json()) as SessionItem[];
						if (!cancelled) setSessions(Array.isArray(data) ? data : []);
					}
				}
			} catch {
				// non-fatal
			} finally {
				if (!cancelled) setLoadingSessions(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, []);

	// ── Password handlers ────────────────────────────────────────────────
	async function handlePasswordChange(values: ChangePasswordValues) {
		try {
			await authClient.changePassword({
				currentPassword: values.currentPassword,
				newPassword: values.newPassword,
				revokeOtherSessions: false,
			});
			toast.success("Password updated successfully");
			changeForm.reset();
		} catch {
			toast.error("Failed to update password. Check your current password.");
		}
	}

	async function handleSetPassword(values: SetPasswordValues) {
		try {
			// WHY setPassword vs changePassword: OAuth-only users have no credential account,
			// so no currentPassword to verify — Better Auth /set-password creates credential.
			const ac = authClient as unknown as {
				setPassword?: (opts: {
					newPassword: string;
				}) => Promise<{ error: unknown }>;
			};
			if (ac.setPassword) {
				const res = await ac.setPassword({ newPassword: values.newPassword });
				if ((res as { error?: unknown })?.error)
					throw new Error("setPassword failed");
			} else {
				// fallback direct fetch
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL ?? ""}/api/auth/set-password`,
					{
						method: "POST",
						credentials: "include",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ newPassword: values.newPassword }),
					},
				);
				if (!res.ok) throw new Error("setPassword failed");
			}
			toast.success("Password set. You can now sign in with email + password.");
			setForm.reset();
			// refresh accounts to reflect credential now exists
			const ac2 = authClient as unknown as {
				listAccounts?: () => Promise<{ data: LinkedAccount[] | null }>;
			};
			if (ac2.listAccounts) {
				const r = await ac2.listAccounts();
				if (r.data) setAccounts(r.data as LinkedAccount[]);
			}
		} catch {
			toast.error("Failed to set password.");
		}
	}

	// ── Linking ──────────────────────────────────────────────────────────
	async function handleLinkGoogle() {
		setLinking(true);
		try {
			// WHY linkSocial: keeps email check via accountLinking, redirects to Google OAuth
			// callbackURL returns to settings so user sees linked badge
			await (
				authClient as unknown as {
					linkSocial: (opts: {
						provider: string;
						callbackURL: string;
					}) => Promise<unknown>;
				}
			).linkSocial({
				provider: "google",
				callbackURL: "/settings?linked=google",
			});
		} catch {
			toast.error("Failed to link Google account.");
			setLinking(false);
		}
	}

	async function handleUnlink(providerId: string) {
		if (providerId === "google" && isOAuthOnly) {
			toast.error("Set a password first, otherwise you'll be locked out.");
			return;
		}
		// prevent unlinking last method
		if (accounts.length <= 1) {
			toast.error("Cannot unlink your only sign-in method.");
			return;
		}
		setUnlinking(providerId);
		try {
			await (
				authClient as unknown as {
					unlinkAccount: (opts: {
						providerId: string;
					}) => Promise<{ error?: unknown }>;
				}
			).unlinkAccount({ providerId });
			toast.success(`${providerId} unlinked`);
			setAccounts((prev) => prev.filter((a) => a.providerId !== providerId));
		} catch {
			toast.error(`Failed to unlink ${providerId}.`);
		} finally {
			setUnlinking(null);
		}
	}

	// ── Sessions ─────────────────────────────────────────────────────────
	async function handleRevokeAllSessions() {
		setIsRevokingAll(true);
		try {
			await authClient.revokeOtherSessions();
			toast.success("All other sessions revoked");
			// refresh list
			const ac = authClient as unknown as {
				listSessions?: () => Promise<{ data: SessionItem[] | null }>;
			};
			if (ac.listSessions) {
				const r = await ac.listSessions();
				if (r.data) setSessions(r.data as SessionItem[]);
			}
		} catch {
			toast.error("Failed to revoke sessions");
		} finally {
			setIsRevokingAll(false);
		}
	}

	async function handleRevokeOne(token: string) {
		if (token === currentToken) {
			toast.error("Cannot revoke current session. Use Sign out instead.");
			return;
		}
		setRevokingToken(token);
		try {
			await (
				authClient as unknown as {
					revokeSession: (opts: {
						token: string;
					}) => Promise<{ error?: unknown }>;
				}
			).revokeSession({ token });
			toast.success("Session revoked");
			setSessions((prev) => prev.filter((s) => s.token !== token));
		} catch {
			toast.error("Failed to revoke session");
		} finally {
			setRevokingToken(null);
		}
	}

	return (
		<Container className="w-full p-0 sm:max-w-180">
			<div className="space-y-6">
				{/* ── Password / Set Password ──────────────────────────────────── */}
				{isOAuthOnly ? (
					<Card>
						<CardContent className="pt-6">
							<form onSubmit={setForm.handleSubmit(handleSetPassword)}>
								<FieldSet className="space-y-4">
									<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
										Set Password
									</p>
									<p className="text-muted-foreground text-xs">
										You signed in with Google. Set a password to also sign in
										with email + password.
									</p>
									<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<Field>
											<FieldLabel>New Password</FieldLabel>
											<Input
												{...setForm.register("newPassword")}
												type="password"
												placeholder="New password"
												autoComplete="new-password"
											/>
											<FieldError>
												{setForm.formState.errors.newPassword?.message}
											</FieldError>
										</Field>
										<Field>
											<FieldLabel>Confirm Password</FieldLabel>
											<Input
												{...setForm.register("confirmPassword")}
												type="password"
												placeholder="Confirm"
												autoComplete="new-password"
											/>
											<FieldError>
												{setForm.formState.errors.confirmPassword?.message}
											</FieldError>
										</Field>
									</FieldGroup>
									<div>
										<Button
											type="submit"
											disabled={setForm.formState.isSubmitting}
										>
											{setForm.formState.isSubmitting
												? "Saving..."
												: "Set Password"}
										</Button>
									</div>
								</FieldSet>
							</form>
						</CardContent>
					</Card>
				) : (
					<Card>
						<CardContent className="pt-6">
							<form onSubmit={changeForm.handleSubmit(handlePasswordChange)}>
								<FieldSet className="space-y-4">
									<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
										Password
									</p>
									<Field>
										<FieldLabel>Current Password</FieldLabel>
										<Input
											{...changeForm.register("currentPassword")}
											type="password"
											placeholder="Enter current password"
											autoComplete="current-password"
										/>
										<FieldError>
											{changeForm.formState.errors.currentPassword?.message}
										</FieldError>
									</Field>
									<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<Field>
											<FieldLabel>New Password</FieldLabel>
											<Input
												{...changeForm.register("newPassword")}
												type="password"
												placeholder="New password"
												autoComplete="new-password"
											/>
											<FieldError>
												{changeForm.formState.errors.newPassword?.message}
											</FieldError>
										</Field>
										<Field>
											<FieldLabel>Confirm Password</FieldLabel>
											<Input
												{...changeForm.register("confirmPassword")}
												type="password"
												placeholder="Confirm new password"
												autoComplete="new-password"
											/>
											<FieldError>
												{changeForm.formState.errors.confirmPassword?.message}
											</FieldError>
										</Field>
									</FieldGroup>
									<div>
										<Button
											type="submit"
											disabled={changeForm.formState.isSubmitting}
										>
											{changeForm.formState.isSubmitting
												? "Updating..."
												: "Update Password"}
										</Button>
									</div>
								</FieldSet>
							</form>
						</CardContent>
					</Card>
				)}

				{/* ── Connected Accounts ───────────────────────────────────────── */}
				<Card>
					<CardContent className="space-y-4 pt-6">
						<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
							Connected Accounts
						</p>
						{!loadingAccounts && !hasGoogle && (
							<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-xs">
								Tip: Link Google for 1-tap sign-in. No extra password to
								remember.
							</div>
						)}
						{/* Google row */}
						<div className="flex items-center justify-between border-border border-b py-3">
							<div className="flex items-start gap-3">
								<IconBrandGoogle className="mt-0.5 size-5 text-muted-foreground" />
								<div>
									<p className="flex items-center gap-2 font-medium text-sm">
										Google{" "}
										{hasGoogle && (
											<Badge variant="secondary" className="text-[10px]">
												Linked
											</Badge>
										)}
									</p>
									<p className="text-muted-foreground text-xs">
										Sign in with Google — fastest for mobile
									</p>
								</div>
							</div>
							{loadingAccounts ? (
								<Button variant="outline" size="sm" disabled>
									...
								</Button>
							) : hasGoogle ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleUnlink("google")}
									disabled={!!unlinking}
								>
									{unlinking === "google" ? "Unlinking..." : "Unlink"}
								</Button>
							) : (
								<Button
									variant="outline"
									size="sm"
									onClick={handleLinkGoogle}
									disabled={linking}
								>
									<IconLink className="mr-1 size-4" />
									{linking ? "Linking..." : "Link"}
								</Button>
							)}
						</div>
						{/* GitHub row — kept for dev but muted for owners */}
						<div className="flex items-center justify-between py-3 opacity-80">
							<div className="flex items-start gap-3">
								<IconBrandGithub className="mt-0.5 size-5 text-muted-foreground" />
								<div>
									<p className="flex items-center gap-2 font-medium text-sm">
										GitHub{" "}
										{hasGithub && (
											<Badge variant="secondary" className="text-[10px]">
												Linked
											</Badge>
										)}
									</p>
									<p className="text-muted-foreground text-xs">
										For developers · optional
									</p>
								</div>
							</div>
							{loadingAccounts ? (
								<Button variant="outline" size="sm" disabled>
									...
								</Button>
							) : hasGithub ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleUnlink("github")}
									disabled={!!unlinking}
								>
									{unlinking === "github" ? "Unlinking..." : "Unlink"}
								</Button>
							) : (
								<Button
									variant="outline"
									size="sm"
									onClick={async () => {
										setLinking(true);
										try {
											await (
												authClient as unknown as {
													linkSocial: (o: {
														provider: string;
														callbackURL: string;
													}) => Promise<unknown>;
												}
											).linkSocial({
												provider: "github",
												callbackURL: "/settings?linked=github",
											});
										} catch {
											toast.error("Failed to link GitHub.");
											setLinking(false);
										}
									}}
									disabled={linking}
								>
									Link
								</Button>
							)}
						</div>
						<p className="text-[11px] text-muted-foreground">
							Other providers (Apple, Microsoft) can be added on demand — Google
							covers 95% of Indian owners.
						</p>
					</CardContent>
				</Card>

				{/* ── Sessions & Devices ───────────────────────────────────────── */}
				<Card>
					<CardContent className="space-y-4 pt-6">
						<div className="flex items-center justify-between">
							<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
								Sessions & Devices
							</p>
							<Button
								variant="destructive"
								size="sm"
								onClick={handleRevokeAllSessions}
								disabled={isRevokingAll || sessions.length <= 1}
							>
								{isRevokingAll ? "Revoking..." : "Revoke Others"}
							</Button>
						</div>
						{loadingSessions ? (
							<p className="text-muted-foreground text-xs">
								Loading sessions...
							</p>
						) : sessions.length === 0 ? (
							<p className="text-muted-foreground text-xs">
								No active sessions found.
							</p>
						) : (
							<div className="space-y-2">
								{sessions.map((s) => {
									const isCurrent = s.token === currentToken;
									return (
										<div
											key={s.id}
											className="flex items-center justify-between rounded-md border px-3 py-2"
										>
											<div className="flex items-start gap-3">
												<IconDevices className="mt-0.5 size-5 text-muted-foreground" />
												<div>
													<p className="flex items-center gap-2 font-medium text-sm">
														{parseUserAgent(s.userAgent)}{" "}
														{isCurrent && (
															<Badge variant="outline" className="text-[10px]">
																This device
															</Badge>
														)}
													</p>
													<p className="text-muted-foreground text-xs">
														IP: {s.ipAddress ?? "unknown"} ·{" "}
														{formatDate(s.createdAt)} · Expires{" "}
														{formatDate(s.expiresAt)}
													</p>
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleRevokeOne(s.token)}
												disabled={isCurrent || revokingToken === s.token}
											>
												{revokingToken === s.token
													? "..."
													: isCurrent
														? "Current"
														: "Revoke"}
											</Button>
										</div>
									);
								})}
							</div>
						)}
						<p className="flex items-center gap-1 text-[11px] text-muted-foreground">
							<IconDeviceMobile className="size-3" /> Location is IP-based.
							Detailed city requires a geo lookup (deferred — IP shown only in
							beta).
						</p>
					</CardContent>
				</Card>

				{/* ── Danger: kept minimal ─────────────────────────────────────── */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div className="flex items-start gap-3">
								<IconKey className="mt-0.5 size-5 text-muted-foreground" />
								<div>
									<p className="font-medium text-sm">Sign out everywhere</p>
									<p className="text-muted-foreground text-xs">
										If you linked Google, you can revoke sessions and keep
										Google sign-in.
									</p>
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => authClient.signOut()}
							>
								Sign out
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</Container>
	);
}
