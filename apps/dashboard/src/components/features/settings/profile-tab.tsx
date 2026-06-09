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
import type { UpsertOwnerProfileInput } from "@rently/validators";
import { UpsertOwnerProfileSchema } from "@rently/validators";
import Image from "next/image";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Container } from "@/components/shared/container";
import {
	useSuspenseOwnerProfile,
	useUpsertOwnerProfile,
} from "@/hooks/settings";
import { useDeleteAvatar, useUploadAvatar } from "@/hooks/upload";
import { useMounted } from "@/hooks/use-mounted";
import { authClient, useSession } from "@/lib/auth-client";

// ── User info form schema (Better Auth fields)
// WHY separate schema: these fields go to authClient.updateUser(), not oRPC.
// They live in the auth user table, not ownerProfiles.
const PersonalInfoSchema = z.object({
	firstName: z.string().min(1, { error: "First name is required" }),
	lastName: z.string().optional(),
	phone: z.string().optional(),
});
type PersonalInfoValues = z.infer<typeof PersonalInfoSchema>;

// ── Avatar initials helper ───────────────
function getInitials(name: string | null | undefined): string {
	if (!name) return "?";
	return name
		.split(" ")
		.slice(0, 2)
		.map((w) => w[0] ?? "")
		.join("")
		.toUpperCase();
}

// ── Split stored "first last" name into separate fields ──
function splitName(name: string | null | undefined) {
	if (!name) return { firstName: "", lastName: "" };
	const parts = name.trim().split(" ");
	return {
		firstName: parts[0] ?? "",
		lastName: parts.slice(1).join(" "),
	};
}

export function ProfileTab() {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { mutate: uploadAvatar, isPending: isUploading } = useUploadAvatar();
	const { mutate: deleteAvatar, isPending: isDeleting } = useDeleteAvatar();

	const { data: session } = useSession();
	const { data: profileData } = useSuspenseOwnerProfile();
	const { mutate: upsertProfile, isPending: isSavingBusiness } =
		useUpsertOwnerProfile();
	const mounted = useMounted();

	const [isSavingPersonal, setIsSavingPersonal] = useState(false);

	const { firstName, lastName } = splitName(session?.user?.name);

	// ── Personal info form (maps to authClient.updateUser) ───
	const personalForm = useForm<PersonalInfoValues>({
		resolver: zodResolver(PersonalInfoSchema),
		values: {
			firstName,
			lastName: lastName ?? "",
			phone: session?.user?.phone ?? "",
		},
	});

	// ── Business details form (maps to oRPC ownerProfile) ──────
	const businessForm = useForm<UpsertOwnerProfileInput>({
		resolver: zodResolver(UpsertOwnerProfileSchema),
		values: {
			companyName: profileData.profile?.companyName ?? "",
			gstNumber: profileData.profile?.gstNumber ?? "",
			address: profileData.profile?.address ?? "",
			upiId: profileData.profile?.upiId ?? "",
		},
	});

	// ── Personal info submit → authClient.updateUser ────
	async function handlePersonalSubmit(values: PersonalInfoValues) {
		setIsSavingPersonal(true);
		try {
			const fullName = [values.firstName, values.lastName]
				.filter(Boolean)
				.join(" ");

			// WHY updateUser for both name AND phone: both live on the Better Auth
			// user table, managed by authClient — not our oRPC procedures.
			// GOTCHA: phone update requires it to be registered in server's
			// auth additionalFields config. Verify if this throws a 400.
			await authClient.updateUser({
				name: fullName,
				phone: values.phone,
			});
			toast.success("Personal details updated");
		} catch (error) {
			toast.error("Failed to update personal details");
			console.error(error); // TODO: remove before prod
		} finally {
			setIsSavingPersonal(false);
		}
	}

	// ── Business details submit → oRPC upsertOwnerProfile ────
	function handleBusinessSubmit(values: UpsertOwnerProfileInput) {
		upsertProfile(values);
	}

	const initials = mounted ? getInitials(session?.user?.name) : "?";

	return (
		<Container className="w-full p-0 sm:max-w-180">
			<div className="space-y-6">
				{/* ── Avatar section ────────────── */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-4">
							{/* Initials avatar — R2 photo upload is a future enhancement */}
							<div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground text-xl">
								{!mounted ? (
									// Server + client first paint: identical output — no mismatch possible
									<span>?</span>
								) : session?.user?.image ? (
									<Image
										src={session.user.image}
										alt="Avatar"
										width={64}
										height={64}
										className="rounded-xl object-cover"
									/>
								) : (
									<span>{initials}</span>
								)}
							</div>
							<div className="flex flex-col gap-1">
								{/* Hidden file input — triggered by the button below */}
								<input
									ref={fileInputRef}
									type="file"
									accept="image/jpeg,image/png,image/webp"
									className="hidden"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (file) uploadAvatar(file);
										// WHY reset: allows re-selecting the same file (onChange won't fire otherwise)
										e.target.value = "";
									}}
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isUploading}
									onClick={() => fileInputRef.current?.click()}
								>
									{isUploading ? "Uploading..." : "Upload Photo"}
								</Button>
								{session?.user?.image && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={isDeleting}
										onClick={() => deleteAvatar()}
										className="text-destructive hover:text-destructive"
									>
										{isDeleting ? "Removing..." : "Remove photo"}
									</Button>
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* ── Personal Information ────── */}
				<Card>
					<CardContent className="pt-6">
						<form onSubmit={personalForm.handleSubmit(handlePersonalSubmit)}>
							<FieldSet className="space-y-4">
								<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
									Personal Information
								</p>

								<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<Field>
										<FieldLabel>First Name</FieldLabel>
										<Input
											{...personalForm.register("firstName")}
											placeholder="First name"
										/>
										<FieldError>
											{personalForm.formState.errors.firstName?.message}
										</FieldError>
									</Field>

									<Field>
										<FieldLabel>Last Name</FieldLabel>
										<Input
											{...personalForm.register("lastName")}
											placeholder="Last name"
										/>
									</Field>
								</FieldGroup>

								<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<Field>
										<FieldLabel>Email Address</FieldLabel>
										{/* WHY disabled: changing email requires a verification
									    email round-trip — build that flow separately */}
										<Input
											value={session?.user?.email ?? ""}
											disabled
											className="bg-muted text-muted-foreground"
										/>
										<p className="mt-1 text-muted-foreground text-xs">
											Contact support to change your email
										</p>
									</Field>

									<Field>
										<FieldLabel>Phone Number</FieldLabel>
										<Input
											{...personalForm.register("phone")}
											placeholder="+91 98765 43210"
											type="tel"
										/>
									</Field>
								</FieldGroup>

								{/* TODO: add bio textarea after DB migration adds bio to ownerProfiles */}

								<div className="flex gap-3 pt-2">
									<Button type="submit" disabled={isSavingPersonal}>
										{isSavingPersonal ? "Saving..." : "Save Changes"}
									</Button>
									<Button
										type="button"
										variant="ghost"
										onClick={() => personalForm.reset()}
									>
										Cancel
									</Button>
								</div>
							</FieldSet>
						</form>
					</CardContent>
				</Card>

				{/* ── Business Details ───── */}
				<Card>
					<CardContent className="pt-6">
						<form onSubmit={businessForm.handleSubmit(handleBusinessSubmit)}>
							<FieldSet className="space-y-4">
								<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
									Business Details
								</p>

								<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<Field>
										<FieldLabel>Business Name</FieldLabel>
										<Input
											{...businessForm.register("companyName")}
											placeholder="Kumar Properties"
										/>
										<FieldError>
											{businessForm.formState.errors.companyName?.message}
										</FieldError>
									</Field>

									<Field>
										<FieldLabel>GST Number</FieldLabel>
										<Input
											{...businessForm.register("gstNumber")}
											placeholder="29AABCK1234N1Z5"
										/>
									</Field>
								</FieldGroup>

								<Field>
									<FieldLabel>Business Address</FieldLabel>
									<Input
										{...businessForm.register("address")}
										placeholder="5th Block, Koramangala, Bangalore, Karnataka 560095"
									/>
								</Field>

								<Field>
									<FieldLabel>UPI ID</FieldLabel>
									<Input
										{...businessForm.register("upiId")}
										placeholder="name@upi"
									/>
									<p className="mt-1 text-muted-foreground text-xs">
										Used to generate rent payment QR codes for tenants
									</p>
								</Field>

								<div className="flex gap-3 pt-2">
									<Button type="submit" disabled={isSavingBusiness}>
										{isSavingBusiness ? "Saving..." : "Save Changes"}
									</Button>
									<Button
										type="button"
										variant="ghost"
										onClick={() => businessForm.reset()}
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
