import z from "zod";

export const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const GetPresignedUploadUrlSchema = z.object({
	key: z.string().min(1, { error: "Key is required" }),
	contentType: z.enum(ALLOWED_IMAGE_TYPES, {
		error: "Only JPEG, PNG, and WebP images are allowed",
	}),
});

export const PresignedUploadUrlResponseSchema = z.object({
	uploadUrl: z.url(),
	publicUrl: z.url(),
});

export type GetPresignedUploadUrlInput = z.infer<
	typeof GetPresignedUploadUrlSchema
>;
export type PresignedUploadUrlResponse = z.infer<
	typeof PresignedUploadUrlResponseSchema
>;
