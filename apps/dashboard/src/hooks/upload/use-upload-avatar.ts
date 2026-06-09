import type { AllowedImageType } from "@rently/validators";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/*

1) Ask our server to sign a put url (auth via session cookie)
2) Put the file directly to r2 (no server bandwidth used)
3) Save the resulting public url to user.image via better-auth

*/

export function useUploadAvatar() {
	const { data: session } = useSession();

	return useMutation({
		onMutate: () => {
			return { toastId: toast.loading("Uploading photo...") };
		},
		mutationFn: async (file: File) => {
			// Client Side gate - fail fast before any network call
			if (file.size > MAX_BYTES) {
				throw new Error("File is too large. Maximum size is 5 MB.");
			}

			const userId = session?.user?.id;
			if (!userId) throw new Error("Not authenticated");

			// Build Key
			const key = `owners/${userId}/avatar`;

			// Step1 - Get presigned url
			const { publicUrl, uploadUrl } =
				await client.upload.getPresignedUploadUrl({
					key,
					contentType: file.type as AllowedImageType,
				});

			// Step2 - Put directly to r2
			const r2Response = await fetch(uploadUrl, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});

			if (!r2Response.ok) {
				throw new Error(`Upload to storage failed (${r2Response.status})`);
			}

			// Step3 - Persist the public user.image

			await authClient.updateUser({
				image: `${publicUrl}?v=${Date.now()}`,
			});

			return publicUrl;
		},
		onSuccess: (_, __, context) => {
			toast.success("Photo updated", { id: context.toastId });
		},
		onError: (error, _, context) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to upload photo",
				{ id: context?.toastId },
			);
		},
	});
}

export function useDeleteAvatar() {
	return useMutation({
		onMutate: () => {
			return { toastId: toast.loading("Deleting photo...") };
		},
		mutationFn: async () => {
			await client.upload.deleteAvatar();
			// WHY after R2 delete: clear the URL from the session profile
			await authClient.updateUser({ image: null });
		},
		onSuccess: (_, __, context) => {
			toast.success("Photo removed", { id: context.toastId });
		},
		onError: (error, _, context) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove photo",
				{ id: context?.toastId },
			);
		},
	});
}
