"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@rently/ui/components/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { Textarea } from "@rently/ui/components/textarea";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useSendEmailToTenant } from "@/hooks/tenants";

// ── Schema ───────────────────────────────────────────────────────────────────
const SendEmailSchema = z.object({
	subject: z.string().min(1, { error: "Subject is required" }),
	message: z
		.string()
		.min(10, { error: "Message must be at least 10 characters" }),
});

type SendEmailFormValues = z.infer<typeof SendEmailSchema>;

// ── Props ────────────────────────────────────────────────────────────────────
interface SendEmailDialogProps {
	tenantId: string;
	tenantName: string;
	trigger: React.ReactNode;
}

export function SendEmailDialog({
	tenantId,
	tenantName,
	trigger,
}: SendEmailDialogProps) {
	const [open, setOpen] = useState(false);
	const sendEmail = useSendEmailToTenant();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<SendEmailFormValues>({
		resolver: zodResolver(SendEmailSchema),
	});

	function onSubmit(values: SendEmailFormValues) {
		sendEmail.mutate(
			{
				tenantId,
				subject: values.subject,
				message: values.message,
			},
			{
				onSuccess: () => {
					setOpen(false);
					reset();
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Send Email to {tenantName}</DialogTitle>
					<DialogDescription>
						This message will be sent directly to the tenant's registered email
						address.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<FieldSet>
						<FieldGroup className="flex flex-col gap-4">
							<Field data-invalid={!!errors.subject}>
								<FieldLabel htmlFor="subject">Subject</FieldLabel>
								<Input
									id="subject"
									placeholder="e.g. Rent reminder for June"
									disabled={sendEmail.isPending}
									{...register("subject")}
									aria-invalid={!!errors.subject}
								/>
								<FieldError errors={[errors.subject]} />
							</Field>

							<Field data-invalid={!!errors.message}>
								<FieldLabel htmlFor="message">Message</FieldLabel>
								<Textarea
									id="message"
									placeholder="Write your message here..."
									rows={5}
									disabled={sendEmail.isPending}
									{...register("message")}
									aria-invalid={!!errors.message}
								/>
								<FieldError errors={[errors.message]} />
							</Field>
						</FieldGroup>
					</FieldSet>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
							disabled={sendEmail.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={sendEmail.isPending}>
							{sendEmail.isPending ? "Sending..." : "Send Email"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
