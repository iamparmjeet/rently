import { env } from "@rently/env/server";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

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
	const inviteUrl = `${env.CORS_ORIGIN}/invite/${token}`;

	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject: `${ownerName} invited you to RentWise`,
		html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#111;margin-bottom:8px;">Hello ${tenantName},</h2>
              <p style="color:#555;line-height:1.6;margin-bottom:24px;">
                <strong>${ownerName}</strong> has invited you to join
                <strong>RentWise</strong> — a platform to manage your rental
                agreement and track payments digitally.
              </p>

                href="${inviteUrl}"
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
              >
                Accept Invitation →
              </a>
              <p style="color:#999;font-size:13px;margin-top:24px;">
                This link expires in 7 days. If you were not expecting this,
                you can safely ignore it.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
              <p style="color:#bbb;font-size:12px;">
                RentWise · Property Management Simplified
              </p>
            </body>
          </html>
        `,
	});

	if (error) {
		// Design decision - log but don't throw
		// Invite is created in DB - owner can ersend from invite page
		// TODO: Retry queue when email infra matures
		console.log("[Resend] Invite email failed", error);
	}
}
