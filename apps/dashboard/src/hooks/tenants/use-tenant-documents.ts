import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";

export function useTenantDocuments(tenantId: string) {
	return useQuery({
		...orpc.rent.tenantDocument.listTenantDocuments.queryOptions({
			input: { tenantId },
		}),
		enabled: Boolean(tenantId),
	});
}

export function useTenantDocumentAction(tenantId: string) {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.rent.tenantDocument.listTenantDocuments.key({
				input: { tenantId },
			}),
		});
	return {
		begin: useMutation({
			mutationFn: (
				input: Parameters<
					typeof client.rent.tenantDocument.beginTenantDocumentUpload
				>[0],
			) => client.rent.tenantDocument.beginTenantDocumentUpload(input),
			onSettled: invalidate,
		}),
		submitInitial: useMutation({
			mutationFn: (
				input: Parameters<
					typeof client.rent.tenantDocument.submitInitialDocument
				>[0],
			) => client.rent.tenantDocument.submitInitialDocument(input),
			onSettled: invalidate,
		}),
		review: useMutation({
			mutationFn: (
				input: Parameters<
					typeof client.rent.tenantDocument.reviewTenantDocument
				>[0],
			) => client.rent.tenantDocument.reviewTenantDocument(input),
			onSettled: invalidate,
		}),
		reviewUpdate: useMutation({
			mutationFn: (
				input: Parameters<
					typeof client.rent.tenantDocument.reviewDocumentUpdateRequest
				>[0],
			) => client.rent.tenantDocument.reviewDocumentUpdateRequest(input),
			onSettled: invalidate,
		}),
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
		submitUpdate: useMutation({
			mutationFn: (
				input: Parameters<
					typeof client.rent.tenantDocument.submitApprovedDocumentUpdate
				>[0],
			) => client.rent.tenantDocument.submitApprovedDocumentUpdate(input),
			onSettled: invalidate,
		}),
		deletePending: useMutation({
			mutationFn: (
				input: Parameters<
					typeof client.rent.tenantDocument.deletePendingDocument
				>[0],
			) => client.rent.tenantDocument.deletePendingDocument(input),
			onSettled: invalidate,
		}),
	};
}
