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

export function useTenantDocumentAction() {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.rent.tenantDocument.listMyDocuments.key(),
		});
	const upload = useMutation({
		mutationFn: async (input: UploadActionInput) => {
			const { file, aadhaarLastFour, maskedAadhaarConfirmed, ...request } =
				input;
			const signed =
				await client.rent.tenantDocument.beginTenantDocumentUpload(request);
			const upload = await fetch(signed.uploadUrl, {
				method: "PUT",
				body: file,
				headers: signed.requiredHeaders,
			});
			if (!upload.ok) throw new Error(`Upload failed (${upload.status})`);
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
