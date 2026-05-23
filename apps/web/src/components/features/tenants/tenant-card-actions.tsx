// apps/web/src/components/features/tenants/tenant-card-actions.tsx
"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@rently/ui/components/alert-dialog";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@rently/ui/components/sheet";
import { Textarea } from "@rently/ui/components/textarea";
import {
	IconDotsVertical,
	IconLoader2,
	IconMail,
	IconPencil,
	IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import {
	useRemoveTenant,
	useSendEmailToTenant,
	useUpdateTenant,
} from "@/hooks/tenants";
import { type Tenant, TenantCard } from "./tenant-card";

// ─── Edit form schema ─────────────────────────────────────────────────────────
const editTenantFormSchema = z.object({
	phone: z.string().optional(),
	address: z.string().optional(),
	emergencyContactName: z.string().optional(),
	emergencyContact: z.string().optional(),
	emergencyContactLocation: z.string().optional(),
	uidNumber: z.string().optional(),
	panNumber: z.string().optional(),
});
type EditTenantForm = z.infer<typeof editTenantFormSchema>;

// ─── Email form schema ────────────────────────────────────────────────────────
const sendEmailFormSchema = z.object({
	subject: z.string().min(1, { error: "Subject is required" }),
	message: z
		.string()
		.min(10, { error: "Message must be at least 10 characters" }),
});
type SendEmailForm = z.infer<typeof sendEmailFormSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────
interface TenantCardActionsProps {
	tenant: Tenant;
}

export function TenantCardActions({ tenant }: TenantCardActionsProps) {
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isEmailOpen, setIsEmailOpen] = useState(false);
	const [isRemoveOpen, setIsRemoveOpen] = useState(false);

	const updateTenant = useUpdateTenant();
	const sendEmail = useSendEmailToTenant();
	const removeTenant = useRemoveTenant();

	// ── Edit form — register pattern, no controller needed
	const {
		register: registerEdit,
		handleSubmit: handleEditSubmit,
		formState: { errors: editErrors },
	} = useForm<EditTenantForm>({
		resolver: zodResolver(editTenantFormSchema),
		defaultValues: {
			phone: tenant.phone ?? "",
			address: "",
			emergencyContactName: "",
			emergencyContact: "",
			emergencyContactLocation: "",
			uidNumber: "",
			panNumber: "",
		},
	});

	// ── Email form
	const {
		register: registerEmail,
		handleSubmit: handleEmailSubmit,
		reset: resetEmail,
		formState: { errors: emailErrors },
	} = useForm<SendEmailForm>({
		resolver: zodResolver(sendEmailFormSchema),
		defaultValues: { subject: "", message: "" },
	});

	// ── Handlers
	function onEditSubmit(values: EditTenantForm) {
		const cleaned = Object.fromEntries(
			Object.entries(values).map(([k, v]) => [k, v === "" ? undefined : v]),
		) as EditTenantForm;

		updateTenant.mutate(
			{ tenantId: tenant.id, ...cleaned },
			{ onSuccess: () => setIsEditOpen(false) },
		);
	}

	function onEmailSubmit(values: SendEmailForm) {
		sendEmail.mutate(
			{ tenantId: tenant.id, ...values },
			{
				onSuccess: () => {
					setIsEmailOpen(false);
					resetEmail();
				},
			},
		);
	}

	function handleRemoveConfirm() {
		removeTenant.mutate(
			{ tenantId: tenant.id },
			{ onSuccess: () => setIsRemoveOpen(false) },
		);
	}

	return (
		<>
			{/* Card with 3-dot menu */}
			<TenantCard
				tenant={tenant}
				actionsSlot={
					<DropdownMenu>
						<DropdownMenuTrigger>
							<Button
								variant="ghost"
								size="icon"
								className="-mt-1 -mr-2 size-8 shrink-0"
							>
								<IconDotsVertical className="size-4" />
								<span className="sr-only">Open menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setIsEditOpen(true)}>
								<IconPencil className="mr-2 size-4" />
								Edit Profile
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setIsEmailOpen(true)}>
								<IconMail className="mr-2 size-4" />
								Send Email
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => setIsRemoveOpen(true)}
							>
								<IconTrash className="mr-2 size-4" />
								Remove Tenant
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				}
			/>

			{/* ── Edit Sheet ── */}
			<Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Edit {tenant.name}</SheetTitle>
						<SheetDescription>
							Update contact and KYC information. Name and email are managed by
							the tenant's account.
						</SheetDescription>
					</SheetHeader>
					<form
						onSubmit={handleEditSubmit(onEditSubmit)}
						className="mt-6 space-y-4"
					>
						<FieldSet>
							<FieldGroup className="flex flex-col gap-4">
								<Field data-invalid={!!editErrors.phone}>
									<FieldLabel htmlFor="phone">Phone</FieldLabel>
									<Input
										id="phone"
										placeholder="+91 98765 43210"
										{...registerEdit("phone")}
										aria-invalid={!!editErrors.phone}
									/>
									<FieldError errors={[editErrors.phone]} />
								</Field>

								<Field data-invalid={!!editErrors.address}>
									<FieldLabel htmlFor="address">Address</FieldLabel>
									<Input
										id="address"
										placeholder="Permanent address"
										{...registerEdit("address")}
										aria-invalid={!!editErrors.address}
									/>
									<FieldError errors={[editErrors.address]} />
								</Field>

								<Field data-invalid={!!editErrors.emergencyContactName}>
									<FieldLabel htmlFor="emergencyContactName">
										Emergency Contact Name
									</FieldLabel>
									<Input
										id="emergencyContactName"
										placeholder="Full name"
										{...registerEdit("emergencyContactName")}
										aria-invalid={!!editErrors.emergencyContactName}
									/>
									<FieldError errors={[editErrors.emergencyContactName]} />
								</Field>

								<Field data-invalid={!!editErrors.emergencyContact}>
									<FieldLabel htmlFor="emergencyContact">
										Emergency Contact Number
									</FieldLabel>
									<Input
										id="emergencyContact"
										type="tel"
										placeholder="+91 98765 43210"
										{...registerEdit("emergencyContact")}
										aria-invalid={!!editErrors.emergencyContact}
									/>
									<FieldError errors={[editErrors.emergencyContact]} />
								</Field>

								<Field data-invalid={!!editErrors.uidNumber}>
									<FieldLabel htmlFor="uidNumber">
										Aadhaar / UID Number
									</FieldLabel>
									<Input
										id="uidNumber"
										placeholder="XXXX XXXX XXXX"
										{...registerEdit("uidNumber")}
										aria-invalid={!!editErrors.uidNumber}
									/>
									<FieldError errors={[editErrors.uidNumber]} />
								</Field>

								<Field data-invalid={!!editErrors.panNumber}>
									<FieldLabel htmlFor="panNumber">PAN Number</FieldLabel>
									<Input
										id="panNumber"
										placeholder="ABCDE1234F"
										{...registerEdit("panNumber")}
										aria-invalid={!!editErrors.panNumber}
									/>
									<FieldError errors={[editErrors.panNumber]} />
								</Field>
							</FieldGroup>
						</FieldSet>

						<SheetFooter className="mt-6">
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsEditOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={updateTenant.isPending}>
								{updateTenant.isPending && (
									<IconLoader2 className="mr-2 size-4 animate-spin" />
								)}
								Save Changes
							</Button>
						</SheetFooter>
					</form>
				</SheetContent>
			</Sheet>

			{/* ── Send Email Dialog ── */}
			<Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Email {tenant.name}</DialogTitle>
						<DialogDescription>Sending to {tenant.email}</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={handleEmailSubmit(onEmailSubmit)}
						className="space-y-4"
					>
						<FieldSet>
							<FieldGroup className="flex flex-col gap-4">
								<Field data-invalid={!!emailErrors.subject}>
									<FieldLabel htmlFor="subject">Subject</FieldLabel>
									<Input
										id="subject"
										placeholder="Rent reminder for October"
										{...registerEmail("subject")}
										aria-invalid={!!emailErrors.subject}
									/>
									<FieldError errors={[emailErrors.subject]} />
								</Field>

								<Field data-invalid={!!emailErrors.message}>
									<FieldLabel htmlFor="message">Message</FieldLabel>
									<Textarea
										id="message"
										placeholder="Write your message here..."
										rows={5}
										{...registerEmail("message")}
										aria-invalid={!!emailErrors.message}
									/>
									<FieldError errors={[emailErrors.message]} />
								</Field>
							</FieldGroup>
						</FieldSet>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsEmailOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={sendEmail.isPending}>
								{sendEmail.isPending && (
									<IconLoader2 className="mr-2 size-4 animate-spin" />
								)}
								Send Email
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* ── Remove Confirmation ── */}
			<AlertDialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove {tenant.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							This will terminate all active leases for this tenant on your
							properties. The tenant's account is not deleted — they just lose
							access to your units. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleRemoveConfirm}
							disabled={removeTenant.isPending}
						>
							{removeTenant.isPending && (
								<IconLoader2 className="mr-2 size-4 animate-spin" />
							)}
							Yes, Remove Tenant
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
