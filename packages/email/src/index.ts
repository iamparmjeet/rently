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
      RentWise · Property Management Simplified
    </p>
  </body>
</html>`;
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
	const inviteUrl = `${env.CORS_ORIGINS}/invite/${token}`;

	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject: `${ownerName} invited you to RentWise`,
		html: emailWrapper(`
      <h2 style="margin-bottom:8px;">Hello ${tenantName},</h2>
      <p style="color:#555;line-height:1.6;margin-bottom:24px;">
        <strong>${ownerName}</strong> has invited you to join
        <strong>RentWise</strong> — a platform to manage your rental
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
		// Design decision - log but don't throw
		// Invite is created in DB - owner can ersend from invite page
		// TODO: Retry queue when email infra matures
		console.log("[Resend] Invite email failed", error);
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
		subject: `${ownerName} added you to RentWise — set up your account`,
		html: emailWrapper(`
      <h2 style="margin-bottom:8px;">Hello ${tenantName},</h2>
      <p style="color:#555;line-height:1.6;margin-bottom:24px;">
        <strong>${ownerName}</strong> has added you as a tenant on
        <strong>RentWise</strong>. Click below to set your password
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
        Message from your landlord, <strong>${ownerName}</strong>
      </p>
      <p>Hi ${tenantName},</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
      <p style="color:#111;line-height:1.7;white-space:pre-wrap;">${message}</p>
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
		subject: "Reset your RentWise password",
		html: emailWrapper(`
      <h2 style="margin-bottom:8px;">Hello ${name},</h2>
      <p style="color:#555;line-height:1.6;margin-bottom:24px;">
        We received a request to reset the password for your RentWise account.
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
