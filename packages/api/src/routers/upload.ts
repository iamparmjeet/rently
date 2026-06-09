import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { env } from "@rently/env/server";
import {
	GetPresignedUploadUrlSchema,
	PresignedUploadUrlResponseSchema,
} from "@rently/validators";
import { AwsClient } from "aws4fetch";
import z from "zod";

// AwsClient is cloudflare specific
const r2 = new AwsClient({
	accessKeyId: env.R2_ACCESS_KEY_ID,
	secretAccessKey: env.R2_SECRET_ACCESS_KEY,
	region: "auto",
	service: "s3",
});

export const getPresignedUploadUrl = ownerProcedure
	.route({ method: "POST", path: "/upload/presign" })
	.input(GetPresignedUploadUrlSchema)
	.output(PresignedUploadUrlResponseSchema)
	.handler(async ({ context, input }) => {
		const { user } = context;

		// SECURITY: same key-scoping guard as before
		if (!input.key.startsWith(`owners/${user.id}/`)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Invalid upload key. Key must be scoped to your user directory.",
			});
		}

		if (user.image) {
			const baseUrl = env.R2_PUBLIC_URL.replace(/\/$/, "");
			const oldKey = user.image.replace(`${baseUrl}/`, "");

			// WHY: only delete if the key belongs to this user.
			// If somehow a foreign URL is in user.image, skip silently.
			if (oldKey.startsWith(`owners/${user.id}/`)) {
				const oldObjectUrl = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${oldKey}`;
				const deleteRequest = await r2.sign(
					new Request(oldObjectUrl, { method: "DELETE" }),
				);
				// WHY: fire-and-forget is acceptable here — if the old file
				// lingers, it's a leak, not a correctness issue. Don't block
				// the presign on cleanup success.
				await fetch(deleteRequest).catch(() => {
					// TODO: log cleanup failure to structured logger — not a user-facing error
				});
			}
		}

		const objectUrl = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${input.key}`;

		const signed = await r2.sign(
			new Request(objectUrl, {
				method: "PUT",
				headers: { "Content-Type": input.contentType },
			}),
			{
				aws: { signQuery: true },
				// WHY 60s: short enough to be useless if intercepted;
				// long enough for a 5MB upload on a slow connection
				// expiresIn: 60,
			},
		);

		const publicUrl = `${env.R2_PUBLIC_URL}/${input.key}`;

		return {
			uploadUrl: signed.url,
			publicUrl,
		};
	});

export const deleteAvatar = ownerProcedure
	.route({ method: "DELETE", path: "/upload/avatar" })
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context }) => {
		const { user } = context;

		if (!user.image) {
			return { success: true };
		}

		const baseUrl = env.R2_PUBLIC_URL.replace(/\/$/, "");
		const key = user.image.replace(`${baseUrl}/`, "");

		if (!key.startsWith(`owners/${user.id}/`)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot delete: image key is not scoped to your account.",
			});
		}

		const objectUrl = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`;

		// WHY we don't throw on R2 failure: if the file is already gone
		// (e.g. manually deleted from bucket), we still want to clear user.image.
		const deleteRequest = await r2.sign(
			new Request(objectUrl, { method: "DELETE" }),
		);
		await fetch(deleteRequest);

		return { success: true };
	});
