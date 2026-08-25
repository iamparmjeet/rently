import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";

type UploadActionInput = Parameters<
	typeof client.rent.tenantDocument.beginTenantDocumentUpload
>[0] & {
	file: File;
	aadhaarLastFour?: string;
	maskedAadhaarConfirmed?: true;
};

export function useTenantDocuments() {
	return useQuery(orpc.rent.tenantDocument.listMyDocuments.queryOptions());
}

function putWithProgress(
	url: string,
	file: File,
	headers: Record<string, string>,
	onProgress?: (pct: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", url, true);
		for (const [k, v] of Object.entries(headers)) { xhr.setRequestHeader(k, v); }
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable && onProgress) {
				onProgress(Math.round((e.loaded / e.total) * 100));
			}
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else reject(new Error(`Upload failed (${xhr.status})`));
		};
		xhr.onerror = () => reject(new Error("Upload failed"));
		xhr.send(file);
	});
}

export function useTenantDocumentAction() {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.rent.tenantDocument.listMyDocuments.key(),
		});
	const upload = useMutation({
		mutationFn: async (
			input: UploadActionInput & { onProgress?: (pct: number) => void },
		) => {
			const {
				file,
				aadhaarLastFour,
				maskedAadhaarConfirmed,
				onProgress,
				...request
			} = input;
			const signed =
				await client.rent.tenantDocument.beginTenantDocumentUpload(request);
			// C+A hybrid: progress for >2MB, else instant spinner via isPending
			if (file.size > 2 * 1024 * 1024 && onProgress) {
				await putWithProgress(
					signed.uploadUrl,
					file,
					signed.requiredHeaders as Record<string, string>,
					onProgress,
				);
			} else {
				const upload = await fetch(signed.uploadUrl, {
					method: "PUT",
					body: file,
					headers: signed.requiredHeaders,
				});
				if (!upload.ok) throw new Error(`Upload failed (${upload.status})`);
			}
			if (request.target.kind === "replacement") {
				return client.rent.tenantDocument.submitApprovedDocumentUpdate({
					documentId: signed.documentId,
					aadhaarLastFour,
					maskedAadhaarConfirmed,
				});
			}
			return client.rent.tenantDocument.submitInitialDocument({
				documentId: signed.documentId,
				aadhaarLastFour,
				maskedAadhaarConfirmed,
				consentAccepted: true,
			});
		},
		onSettled: invalidate,
	});
	return {
		...upload,
		confirm: useMutation({
			mutationFn: (
				input: Parameters<
					typeof client.rent.tenantDocument.confirmOwnerSubmittedDocument
				>[0],
			) => client.rent.tenantDocument.confirmOwnerSubmittedDocument(input),
			onSettled: invalidate,
		}),
		requestUpdate: useMutation({
			mutationFn: (
				input: Parameters<
					typeof client.rent.tenantDocument.createDocumentUpdateRequest
				>[0],
			) => client.rent.tenantDocument.createDocumentUpdateRequest(input),
			onSettled: invalidate,
		}),
	};
}
