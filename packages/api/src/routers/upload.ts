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

// * Helpers
function buildR2ObjectUrl(key: string): string {
	return `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`;
}

function extractKeyFromImageUrl(imageUrl: string): string {
	const baseUrl = env.R2_PUBLIC_URL.replace(/\/$/, "");
	const urlWithoutQuery = imageUrl.split("?")[0] as string;
	return urlWithoutQuery.replace(`${baseUrl}/`, "");
}

// ***** Procedures
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

		// No Cleanup - Client always sends the fixed Key
		// `owners/${userId}/avatar`. R2 PUT to an existing key overwrites
		// atomically — no orphan files, no cleanup step needed.

		const signed = await r2.sign(
			new Request(buildR2ObjectUrl(input.key), {
				method: "PUT",
				headers: { "Content-Type": input.contentType },
			}),
			{
				aws: { signQuery: true },
			},
		);

		const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${input.key}`;

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

		const key = extractKeyFromImageUrl(user.image);

		// SECURITY: verify the derived key still belongs to this user.
		// Protects against any future code path that stores a foreign URL
		// in user.image.
		if (!key.startsWith(`owners/${user.id}/`)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot delete: image key is not scoped to your account.",
			});
		}

		// WHY we don't throw on R2 failure: if the file is already gone
		// (e.g. manually deleted from bucket), we still want to clear user.image.
		const deleteRequest = await r2.sign(
			new Request(buildR2ObjectUrl(key), { method: "DELETE" }),
		);

		await fetch(deleteRequest);

		return { success: true };
	});
