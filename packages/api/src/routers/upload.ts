import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { env } from "@rently/env/server";
import {
	GetPresignedUploadUrlSchema,
	PresignedUploadUrlResponseSchema,
} from "@rently/validators";
import { AwsClient } from "aws4fetch";

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
