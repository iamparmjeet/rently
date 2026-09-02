import { env } from "@rently/env/server";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

// ── Shared HTML wrapper
function emailWrapper(body: string): string {
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#bbb;font-size:12px;margin:0;">
      KeyHQ · Property Management Simplified
    </p>
  </body>
</html>`;
}

function escapeHtml(value: unknown): string {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function formatAmount(paise: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(paise / 100);
}

function formatDate(value: Date | string): string {
	return new Date(value).toLocaleDateString("en-IN", {
		timeZone: "Asia/Kolkata",
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

function formatLabel(value: string): string {
	return value
		.replaceAll("_", " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

async function sendKeyHQEmail({
	to,
	subject,
	html,
}: {
	to: string;
	subject: string;
	html: string;
}): Promise<void> {
	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject,
		html: emailWrapper(html),
	});
	if (error) {
		console.error("[Resend] KeyHQ tenant email failed", {
			name: error.name,
			message: error.message,
		});
		throw new Error("TENANT_EMAIL_DELIVERY_FAILED");
	}
}

export interface PaymentReceiptEmailParams {
	to: string;
	tenantName: string;
	ownerName: string;
	propertyName: string;
	unitNumber: string;
	amount: number;
	paymentDate: Date | string;
	paymentType: string;
	paymentMethod?: string | null;
	referenceNumber?: string | null;
}

export interface AgreementPaymentReceiptAllocation {
	unitNumber: string;
	amount: number;
}

export interface AgreementPaymentReceiptEmailParams {
	to: string;
	tenantName: string;
	ownerName: string;
	propertyName: string;
	allocations: AgreementPaymentReceiptAllocation[];
	paymentDate: Date | string;
	paymentMethod?: string | null;
	referenceNumber?: string | null;
}

export async function sendAgreementPaymentReceiptEmail(
	params: AgreementPaymentReceiptEmailParams,
): Promise<void> {
	const total = params.allocations.reduce((sum, item) => sum + item.amount, 0);
	const rows = params.allocations
		.map(
			(item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${escapeHtml(item.unitNumber)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${escapeHtml(formatAmount(item.amount))}</td>
      </tr>`,
		)
		.join("");
	await sendKeyHQEmail({
		to: params.to,
		subject: `Payment receipt — ${formatAmount(total)}`,
		html: `
      <h2 style="margin:0 0 8px;color:#0f172a;">Payment received</h2>
      <p style="color:#555;line-height:1.6;">Hello ${escapeHtml(params.tenantName)}, ${escapeHtml(params.ownerName)} has recorded one payment for your combined agreement.</p>
      <p style="color:#64748b;font-size:14px;">${escapeHtml(params.propertyName)} · ${escapeHtml(formatDate(params.paymentDate))}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <thead><tr><th style="padding:8px 0;text-align:left;color:#64748b;font-weight:500;">Unit</th><th style="padding:8px 0;text-align:right;color:#64748b;font-weight:500;">Allocated amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td style="padding:14px 0 0;font-weight:700;">Total received</td><td style="padding:14px 0 0;text-align:right;font-weight:700;">${escapeHtml(formatAmount(total))}</td></tr></tfoot>
      </table>
      <p style="color:#555;line-height:1.6;">Method: ${escapeHtml(params.paymentMethod ? formatLabel(params.paymentMethod) : "Not provided")} · Reference: ${escapeHtml(params.referenceNumber ?? "Not provided")}</p>
    `,
	});
}

export async function sendPaymentReceiptEmail(
	params: PaymentReceiptEmailParams,
): Promise<void> {
	const method = params.paymentMethod
		? formatLabel(params.paymentMethod)
		: "Not provided";
	await sendKeyHQEmail({
		to: params.to,
		subject: `Payment receipt — ${formatAmount(params.amount)}`,
		html: `
      <h2 style="margin:0 0 8px;color:#0f172a;">Payment received</h2>
      <p style="color:#555;line-height:1.6;">Hello ${escapeHtml(params.tenantName)}, ${escapeHtml(params.ownerName)} has recorded your payment on KeyHQ.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr><td style="padding:8px 0;color:#64748b;">Property / unit</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(params.propertyName)} / ${escapeHtml(params.unitNumber)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Payment type</td><td style="padding:8px 0;text-align:right;">${escapeHtml(formatLabel(params.paymentType))}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Amount</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(formatAmount(params.amount))}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Payment date</td><td style="padding:8px 0;text-align:right;">${escapeHtml(formatDate(params.paymentDate))}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Method</td><td style="padding:8px 0;text-align:right;text-transform:capitalize;">${escapeHtml(method)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Reference number</td><td style="padding:8px 0;text-align:right;">${escapeHtml(params.referenceNumber ?? "Not provided")}</td></tr>
      </table>
      <p style="color:#555;line-height:1.6;">Keep this email for your records.</p>
    `,
	});
}

export interface UtilityBillLine {
	utilityType: string;
	totalAmount: number;
	currentReading?: number | null;
	previousReading?: number | null;
	unitsUsed?: number | null;
	currentReadingDate?: Date | string | null;
	description?: string | null;
}

export interface UtilityBillEmailParams {
	to: string;
	tenantName: string;
	ownerName: string;
	propertyName: string;
	unitNumber: string;
	billingDate: Date | string;
	periodLabel?: string | null;
	utilities: UtilityBillLine[];
}

export async function sendUtilityBillEmail(
	params: UtilityBillEmailParams,
): Promise<void> {
	const total = params.utilities.reduce(
		(sum, item) => sum + item.totalAmount,
		0,
	);
	const rows = params.utilities
		.map((item) => {
			const usage =
				item.unitsUsed == null
					? "—"
					: `${item.previousReading ?? "—"} → ${item.currentReading ?? "—"} (${item.unitsUsed} units)`;
			return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-transform:capitalize;">${escapeHtml(item.utilityType)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${escapeHtml(formatAmount(item.totalAmount))}</td>
					<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b;">${escapeHtml(usage)}</td>
				  </tr>`;
		})
		.join("");
	await sendKeyHQEmail({
		to: params.to,
		subject: `Utility bill — ${formatAmount(total)}`,
		html: `
      <h2 style="margin:0 0 8px;color:#0f172a;">Utility bill generated</h2>
      <p style="color:#555;line-height:1.6;">Hello ${escapeHtml(params.tenantName)}, ${escapeHtml(params.ownerName)} has generated a utility bill for your KeyHQ tenancy.</p>
      <p style="color:#64748b;font-size:14px;">${escapeHtml(params.propertyName)} / ${escapeHtml(params.unitNumber)} · ${escapeHtml(params.periodLabel ?? formatDate(params.billingDate))}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <thead><tr><th style="padding:8px 0;text-align:left;color:#64748b;font-weight:500;">Utility</th><th style="padding:8px 0;text-align:right;color:#64748b;font-weight:500;">Amount</th><th style="padding:8px 0;text-align:right;color:#64748b;font-weight:500;">Usage</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2" style="padding:14px 0 0;font-weight:700;">Total</td><td style="padding:14px 0 0;text-align:right;font-weight:700;">${escapeHtml(formatAmount(total))}</td></tr></tfoot>
      </table>
    `,
	});
}

export interface ScheduledReminderEmailBaseParams {
	to: string;
	tenantName: string;
	ownerName: string;
	propertyName: string;
	unitNumber: string;
	rent: number;
}

export interface LeaseExpiryReminderEmailParams
	extends ScheduledReminderEmailBaseParams {
	endDate: Date | string;
	daysUntilExpiry: number;
}

export async function sendLeaseExpiryReminderEmail(
	params: LeaseExpiryReminderEmailParams,
): Promise<void> {
	await sendKeyHQEmail({
		to: params.to,
		subject: `Lease expiry reminder — ${params.daysUntilExpiry} days remaining`,
		html: `
      <h2 style="margin:0 0 8px;color:#0f172a;">Lease expiry reminder</h2>
      <p style="color:#555;line-height:1.6;">Hello ${escapeHtml(params.tenantName)}, your lease managed by ${escapeHtml(params.ownerName)} is due to expire soon.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr><td style="padding:8px 0;color:#64748b;">Property / unit</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(params.propertyName)} / ${escapeHtml(params.unitNumber)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Lease end date</td><td style="padding:8px 0;text-align:right;">${escapeHtml(formatDate(params.endDate))}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Time remaining</td><td style="padding:8px 0;text-align:right;font-weight:700;">${params.daysUntilExpiry} day${params.daysUntilExpiry === 1 ? "" : "s"}</td></tr>
      </table>
      <p style="color:#555;line-height:1.6;">Please contact ${escapeHtml(params.ownerName)} if you would like to discuss renewal or move-out arrangements.</p>
    `,
	});
}

export interface RentDueReminderEmailParams
	extends ScheduledReminderEmailBaseParams {
	dueDate: Date | string;
	leadDays: number;
}

export async function sendRentDueReminderEmail(
	params: RentDueReminderEmailParams,
): Promise<void> {
	await sendKeyHQEmail({
		to: params.to,
		subject: `Rent due reminder — ${formatAmount(params.rent)}`,
		html: `
      <h2 style="margin:0 0 8px;color:#0f172a;">Rent due reminder</h2>
      <p style="color:#555;line-height:1.6;">Hello ${escapeHtml(params.tenantName)}, this is a friendly reminder from ${escapeHtml(params.ownerName)} about your upcoming rent payment.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr><td style="padding:8px 0;color:#64748b;">Property / unit</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(params.propertyName)} / ${escapeHtml(params.unitNumber)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Rent amount</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(formatAmount(params.rent))}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Due date</td><td style="padding:8px 0;text-align:right;">${escapeHtml(formatDate(params.dueDate))}</td></tr>
      </table>
      <p style="color:#555;line-height:1.6;">If you have already paid, please allow time for the payment to be recorded.</p>
    `,
	});
}

export interface OverdueRentReminderEmailParams
	extends ScheduledReminderEmailBaseParams {
	dueDate: Date | string;
	graceDays: number;
}

export async function sendOverdueRentReminderEmail(
	params: OverdueRentReminderEmailParams,
): Promise<void> {
	await sendKeyHQEmail({
		to: params.to,
		subject: `Rent payment overdue — ${formatAmount(params.rent)}`,
		html: `
      <h2 style="margin:0 0 8px;color:#0f172a;">Rent payment overdue</h2>
      <p style="color:#555;line-height:1.6;">Hello ${escapeHtml(params.tenantName)}, our records show that the rent for your KeyHQ tenancy has not been fully recorded yet.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr><td style="padding:8px 0;color:#64748b;">Property / unit</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(params.propertyName)} / ${escapeHtml(params.unitNumber)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Rent amount</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(formatAmount(params.rent))}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Original due date</td><td style="padding:8px 0;text-align:right;">${escapeHtml(formatDate(params.dueDate))}</td></tr>
      </table>
      <p style="color:#555;line-height:1.6;">If you are facing difficulty, please contact ${escapeHtml(params.ownerName)} directly so you can discuss the next step.</p>
    `,
	});
}
// / ── Shared CTA button
function ctaButton(href: string, label: string): string {
	return `<a
    href="${href}"
    style="
      display:inline-block;
      background:#0f172a;
      color:#fff;
      padding:12px 28px;
      border-radius:8px;
      text-decoration:none;
      font-weight:600;
      font-size:15px;
    "
  >${label}</a>`;
}

// ── 1) Invite email
interface InviteEmailParams {
	to: string;
	tenantName: string;
	ownerName: string;
	token: string;
}

export async function sendInviteEmail({
	ownerName,
	tenantName,
	to,
	token,
}: InviteEmailParams): Promise<void> {
	const inviteUrl = new URL(
		`/invite/${encodeURIComponent(token)}`,
		env.WEB_APP_URL,
	).toString();

	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject: `${ownerName} invited you to KeyHQ`,
		html: emailWrapper(`
      <h2 style="margin-bottom:8px;">Hello ${tenantName},</h2>
      <p style="color:#555;line-height:1.6;margin-bottom:24px;">
        <strong>${ownerName}</strong> has invited you to join
        <strong>KeyHQ</strong> — a platform to manage your rental
        agreement and track payments digitally.
      </p>
      ${ctaButton(inviteUrl, "Accept Invitation →")}
      <p style="color:#999;font-size:13px;margin-top:24px;">
        This link expires in 7 days. If you were not expecting this,
        you can safely ignore it.
      </p>
    `),
	});

	if (error) {
		console.error("[Resend] Invite email delivery failed", {
			name: error.name,
			message: error.message,
		});
		throw new Error("INVITE_EMAIL_DELIVERY_FAILED");
	}
}

// ── 2) Tenant setup email
interface TenantSetupEmailParams {
	to: string;
	tenantName: string;
	ownerName: string;
	setupUrl: string;
}

export async function sendTenantSetupEmail({
	to,
	tenantName,
	ownerName,
	setupUrl,
}: TenantSetupEmailParams): Promise<void> {
	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject: `${ownerName} added you to KeyHQ — set up your account`,
		html: emailWrapper(`
      <h2 style="margin-bottom:8px;">Hello ${tenantName},</h2>
      <p style="color:#555;line-height:1.6;margin-bottom:24px;">
        <strong>${ownerName}</strong> has added you as a tenant on
        <strong>KeyHQ</strong>. Click below to set your password
        and complete your profile.
      </p>
      ${ctaButton(setupUrl, "Set Up Your Account →")}
      <p style="color:#999;font-size:13px;margin-top:24px;">
        This link expires in 24 hours.
      </p>
    `),
	});

	if (error) {
		console.error("[Resend] Tenant setup email failed", error);
	}
}

// ── 3) Custom tenant email
interface CustomEmailParams {
	to: string;
	subject: string;
	message: string;
	ownerName: string;
	tenantName: string;
}

export async function sendCustomEmailToTenant({
	to,
	subject,
	message,
	ownerName,
	tenantName,
}: CustomEmailParams): Promise<void> {
	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject,
		html: emailWrapper(`
      <p style="color:#555;font-size:14px;margin-bottom:4px;">
        Message from your landlord, <strong>${escapeHtml(ownerName)}</strong>
      </p>
      <p>Hi ${escapeHtml(tenantName)},</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
      <p style="color:#111;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</p>
    `),
	});

	if (error) {
		// Non-fatal — consistent with existing email pattern
		// TODO: add to retry queue when email infra matures
		console.error("[Resend] Custom tenant email failed", error);
	}
}

// ── 3) password reset email
interface PasswordResetEmailParams {
	to: string;
	name: string;
	resetUrl: string;
}

export async function sendPasswordResetEmail({
	to,
	name,
	resetUrl,
}: PasswordResetEmailParams): Promise<void> {
	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject: "Reset your KeyHQ password",
		html: emailWrapper(`
      <h2 style="margin-bottom:8px;">Hello ${name},</h2>
      <p style="color:#555;line-height:1.6;margin-bottom:24px;">
        We received a request to reset the password for your KeyHQ account.
        Click the button below to choose a new password.
      </p>
      ${ctaButton(resetUrl, "Reset My Password →")}
      <p style="color:#999;font-size:13px;margin-top:24px;">
        This link expires in 1 hours. If you did not request a password reset,
        you can safely ignore this email.
      </p>
    `),
	});

	if (error) {
		// WHY: Consistent with the rest of the email layer — log, don't throw.
		// The token is already generated and valid; user can request again.
		console.error("[Resend] Owner password reset email failed", error);
	}
}

interface VerificationEmailParams {
	to: string;
	name: string;
	verificationUrl: string;
}

export async function sendVerificationEmail({
	to,
	name,
	verificationUrl,
}: VerificationEmailParams): Promise<void> {
	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject: "Verify your KeyHQ email address",
		html: emailWrapper(`
					<h2 style="margin-bottom:8px;">Hello ${name},</h2>
					<p style="color:#555;line-height:1.6;margin-bottom:24px;">
						Verify your email address to securely access your KeyHQ account.
					</p>
					${ctaButton(verificationUrl, "Verify Email Address")}
					<p style="color:#999;font-size:13px;margin-top:24px;">
						If you did not create or sign in to a KeyHQ account, you can safely ignore this email.
					</p>
				`),
	});
	if (error) {
		console.error("[Resend] Verification email failed", {
			name: error.name,
			message: error.message,
		});
		throw new Error("VERIFICATION_EMAIL_DELIVERY_FAILED");
	}
}
