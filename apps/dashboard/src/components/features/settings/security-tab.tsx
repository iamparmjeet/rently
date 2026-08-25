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
	IconClock,
	IconDeviceDesktop,
	IconDeviceMobile,
	IconDeviceTablet,
	IconKey,
	IconLink,
	IconMapPin,
	IconShieldCheck,
	IconWorld,
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

function getDeviceInfo(ua?: string | null) {
	if (!ua)
		return {
			label: "Unknown device",
			os: "Unknown",
			browser: "Unknown",
			icon: IconWorld,
			kind: "unknown" as const,
		};
	const lower = ua.toLowerCase();
	// Browser
	let browser = "Browser";
	if (lower.includes("edg/")) browser = "Edge";
	else if (lower.includes("chrome") && !lower.includes("chromium"))
		browser = "Chrome";
	else if (lower.includes("safari") && !lower.includes("chrome"))
		browser = "Safari";
	else if (lower.includes("firefox")) browser = "Firefox";
	else if (lower.includes("opera") || lower.includes("opr/")) browser = "Opera";
	// OS + device kind
	if (lower.includes("iphone"))
		return {
			label: "iPhone",
			os: "iOS",
			browser,
			icon: IconDeviceMobile,
			kind: "mobile" as const,
		};
	if (lower.includes("ipad"))
		return {
			label: "iPad",
			os: "iPadOS",
			browser,
			icon: IconDeviceTablet,
			kind: "tablet" as const,
		};
	if (lower.includes("android"))
		return {
			label: "Android",
			os: "Android",
			browser,
			icon: IconDeviceMobile,
			kind: "mobile" as const,
		};
	if (lower.includes("windows"))
		return {
			label: "Windows PC",
			os: "Windows",
			browser,
			icon: IconDeviceDesktop,
			kind: "desktop" as const,
		};
	if (lower.includes("macintosh") || lower.includes("mac os"))
		return {
			label: "Mac",
			os: "macOS",
			browser,
			icon: IconDeviceDesktop,
			kind: "desktop" as const,
		};
	if (lower.includes("linux"))
		return {
			label: "Linux",
			os: "Linux",
			browser,
			icon: IconDeviceDesktop,
			kind: "desktop" as const,
		};
	return {
		label: browser,
		os: "Unknown",
		browser,
		icon: IconWorld,
		kind: "unknown" as const,
	};
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

function timeAgo(d: string | Date) {
	const diff = Date.now() - new Date(d).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days < 7) return `${days}d ago`;
	return formatDate(d);
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

				{/* ── Sessions & Devices — polished ─────────────────────────────── */}
				<Card className="overflow-hidden">
					<CardContent className="space-y-4 pt-6">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
									Sessions & Devices
								</p>
								<p className="text-muted-foreground text-xs">
									{loadingSessions
										? "Checking devices…"
										: `${sessions.length} active ${sessions.length === 1 ? "session" : "sessions"}`}{" "}
									· Manage where you’re signed in
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleRevokeAllSessions}
								disabled={isRevokingAll || sessions.length <= 1}
								className="shrink-0"
							>
								{isRevokingAll ? "Revoking…" : "Revoke others"}
							</Button>
						</div>

						{loadingSessions ? (
							<div className="space-y-3">
								{[1, 2].map((i) => (
									<div key={i} className="animate-pulse rounded-xl border p-4">
										<div className="flex gap-3">
											<div className="size-10 rounded-full bg-muted" />
											<div className="flex-1 space-y-2">
												<div className="h-3 w-32 rounded bg-muted" />
												<div className="h-2 w-48 rounded bg-muted" />
											</div>
										</div>
									</div>
								))}
							</div>
						) : sessions.length === 0 ? (
							<div className="rounded-xl border border-dashed p-8 text-center">
								<IconShieldCheck className="mx-auto size-8 text-muted-foreground/60" />
								<p className="mt-2 font-medium text-sm">No active sessions</p>
								<p className="text-muted-foreground text-xs">
									You’ll see your devices here once you sign in.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{sessions
									.slice()
									.sort((a, b) =>
										a.token === currentToken
											? -1
											: b.token === currentToken
												? 1
												: new Date(b.createdAt).getTime() -
													new Date(a.createdAt).getTime(),
									)
									.map((s) => {
										const isCurrent = s.token === currentToken;
										const info = getDeviceInfo(s.userAgent);
										const Icon = info.icon;
										return (
											<div
												key={s.id}
												className={`group relative rounded-xl border p-4 transition-colors ${isCurrent ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" : "bg-card hover:bg-muted/40"}`}
											>
												<div className="flex gap-3">
													<div
														className={`flex size-10 shrink-0 items-center justify-center rounded-full ${isCurrent ? "bg-emerald-500 text-white shadow-sm" : info.kind === "mobile" ? "bg-sky-500 text-white" : info.kind === "tablet" ? "bg-violet-500 text-white" : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"}`}
													>
														<Icon className="size-5" />
													</div>
													<div className="min-w-0 flex-1">
														<div className="flex flex-wrap items-center gap-2">
															<span className="font-medium text-sm">
																{info.label} · {info.browser}
															</span>
															{isCurrent ? (
																<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2 py-0.5 font-medium text-[11px] text-white">
																	<span className="size-1.5 animate-pulse rounded-full bg-white" />{" "}
																	This device
																</span>
															) : (
																<Badge
																	variant="secondary"
																	className="rounded-full px-2 py-0 font-normal text-[10px]"
																>
																	Active
																</Badge>
															)}
															<Badge
																variant="outline"
																className="rounded-full px-2 py-0 font-normal text-[10px]"
															>
																{info.os}
															</Badge>
														</div>

														<div className="mt-2 flex flex-wrap gap-2">
															<span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-[11px]">
																<IconMapPin className="size-3" />{" "}
																{s.ipAddress ?? "Unknown IP"}{" "}
																<span className="text-muted-foreground">
																	· IP
																</span>
															</span>
															<span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-[11px]">
																<IconClock className="size-3" />{" "}
																{timeAgo(s.createdAt)}{" "}
																<span className="text-muted-foreground">
																	· {formatDate(s.createdAt)}
																</span>
															</span>
														</div>

														<p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">
															{info.browser} on {info.os} · Expires{" "}
															{formatDate(s.expiresAt)} ·{" "}
															<span className="hidden sm:inline">
																{s.userAgent?.slice(0, 80) ?? "no user agent"}
															</span>
														</p>
													</div>

													<div className="flex shrink-0 flex-col items-end gap-2">
														<Button
															variant={isCurrent ? "ghost" : "outline"}
															size="sm"
															onClick={() => handleRevokeOne(s.token)}
															disabled={isCurrent || revokingToken === s.token}
															className={`h-8 rounded-full px-4 text-xs ${isCurrent ? "text-muted-foreground" : "hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"}`}
														>
															{revokingToken === s.token
																? "…"
																: isCurrent
																	? "Current"
																	: "Revoke"}
														</Button>
														{isCurrent && (
															<span className="text-[10px] text-emerald-600 dark:text-emerald-400">
																Can’t revoke current
															</span>
														)}
													</div>
												</div>
											</div>
										);
									})}
							</div>
						)}

						<div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-[11px] text-muted-foreground">
							<IconShieldCheck className="mt-0.5 size-3.5 shrink-0" />
							<span>
								Location is IP-based for beta. City-level lookup (ipapi)
								deferred — IP shown only. Revoking a session signs that device
								out immediately.
							</span>
						</div>
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
