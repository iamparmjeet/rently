import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import type { LeaseWithDetails, UtilityListItem } from "@rently/validators";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

type UtilityListCache = { utilities: UtilityListItem[] };
type LeaseListCache = { leases: LeaseWithDetails[] };

//  Non-optimistic mutations
// Used on pages that don't need instant UI feedback (e.g. detail page edits).

export function useCreateUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Recording meter reading...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.createUtility>[0],
		) => client.rent.utility.createUtility(input),
		onError: (error, _, context) => {
			toast.error(`Failed to record reading: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			toast.success("Reading recorded", { id: context.toastId });
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
		},
	});
}

export function useUpdateUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Updating utility...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.updateUtility>[0],
		) => client.rent.utility.updateUtility(input),
		onError: (error, _, context) => {
			toast.error(`Failed to update utility: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			toast.success("Utility Updated", { id: context.toastId });
		},
		onSettled: (_, __, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			});
		},
	});
}

export function useRemoveUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Deleting utility...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.removeUtility>[0],
		) => client.rent.utility.removeUtility(input),
		onError: (error, _, context) => {
			toast.error(`Failed to Delete: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, variables, context) => {
			// WHY removeQueries in onSuccess, not onSettled: we only want to purge
			// the detail cache when the delete actually succeeded. onSettled fires
			// on both success and error — we don't want to nuke a cache entry if
			// the delete failed.
			queryClient.removeQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Utility Deleted successfully.", { id: context.toastId });
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
		},
	});
}

export function useCreateUtilityBatch() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Recording utility bill...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.createUtilityBatch>[0],
		) => client.rent.utility.createUtilityBatch(input),
		onSuccess: (_, __, context) => {
			toast.success("Utility bill recorded", { id: context.toastId });
		},
		onError: (error, _, context) => {
			toast.error(`Failed to record bill: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
		},
	});
}

//  Optimistic mutations
// Used on the main utilities list page where instant feedback matters.
//
// Pattern for all three:
//   onMutate  → snapshot + optimistic apply  (BEGIN TRANSACTION)
//   onError   → restore snapshot             (ROLLBACK)
//   onSuccess → toast only                   (no cache work — onSettled covers it)
//   onSettled → invalidateQueries            (always refetch, success or error)
//
// WHY onSettled for invalidation and not onSuccess:
// onSettled fires on BOTH success and error paths. Putting invalidation there
// means the server is always the source of truth after the mutation resolves,
// regardless of outcome. Duplicating it in onSuccess just fires it twice.

export function useOptimisticCreateUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Recording utility reading...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});

			// FIX: generic must match the cache SHAPE — { utilities: UtilityListItem[] }
			// not the item type UtilityListItem. Wrong generic → getQueryData returns
			// undefined silently → rollback in onError never fires.
			const prevList = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
			);

			const unitsUsed = variables.currentReading - variables.previousReading;
			const totalAmount =
				(variables.currentReading - variables.previousReading) *
					(variables.ratePerUnit ?? RATEPERUNIT) +
				(variables.fixedCharge ?? FIXEDCHARGE);

			const optimisticRow: UtilityListItem = {
				id: `optimistic-${Date.now()}`,
				leaseId: variables.leaseId,
				batchId: variables.batchId ?? `optimistic-batch-${Date.now()}`,
				utilityType: variables.utilityType,
				previousReading: variables.previousReading,
				currentReading: variables.currentReading,
				ratePerUnit: variables.ratePerUnit ?? RATEPERUNIT,
				unitsUsed,
				fixedCharge: variables.fixedCharge ?? FIXEDCHARGE,
				totalAmount,
				description: variables.description ?? null,
				isPaid: false,
				createdAt: new Date(),
				updatedAt: new Date(),
				currentReadingDate: new Date(),
				previousReadingDate: new Date(),
				unitNumber: "",
				propertyName: "",
				tenantName: null,
				tenantPhone: null,
				tenantEmail: null,
				receiptPaymentId: null,
			};

			queryClient.setQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
				(old) => {
					if (!old) return old;
					return { ...old, utilities: [optimisticRow, ...old.utilities] };
				},
			);

			return { toastId, prevList };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.createUtility>[0],
		) => client.rent.utility.createUtility(input),
		onError: (error, _, context) => {
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.utility.listUtilities.key(),
					context.prevList,
				);
			}
			toast.error(`Failed to record reading: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			// WHY: toast only — onSettled handles invalidation on both paths
			toast.success("Reading recorded", { id: context.toastId });
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
		},
	});
}

export function useOptimisticUpdateUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Updating utility...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			});

			const prevList = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
			);
			const prevDetail = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			);

			queryClient.setQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						// FIX: was `{ ...u, variables }` which nested variables as a
						// property instead of spreading its fields onto the row object.
						utilities: old.utilities.map((u) =>
							u.id === variables.id ? { ...u, ...variables } : u,
						),
					};
				},
			);

			return { toastId, prevDetail, prevList, id: variables.id };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.updateUtility>[0],
		) => client.rent.utility.updateUtility(input),
		onError: (error, _, context) => {
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.utility.listUtilities.key(),
					context.prevList,
				);
			}
			if (context?.prevDetail !== undefined) {
				queryClient.setQueryData(
					orpc.rent.utility.getUtilityById.key({
						input: { id: context.id },
					}),
					context.prevDetail,
				);
			}
			toast.error(`Failed to update utility: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			// WHY: toast only — onSettled handles invalidation on both paths
			toast.success("Utility Updated", { id: context.toastId });
		},
		onSettled: (_, __, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			});
		},
	});
}

export function useOptimisticRemoveUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Deleting utility...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});

			const prevList = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
			);

			queryClient.setQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						utilities: old.utilities.filter((p) => p.id !== variables.id),
					};
				},
			);

			return { toastId, prevList, id: variables.id };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.removeUtility>[0],
		) => client.rent.utility.removeUtility(input),
		onError: (error, _, context) => {
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.utility.listUtilities.key(),
					context.prevList,
				);
			}
			toast.error(`Failed to Delete: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			// WHY removeQueries in onSuccess only: purge the detail cache only on
			// confirmed delete. onSettled (which fires on error too) would
			// incorrectly nuke the cache even if the delete failed.
			queryClient.removeQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: context.id },
				}),
			});
			toast.success("Utility Deleted successfully.", { id: context.toastId });
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
		},
	});
}

export function useOptimisticCreateBatchUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Recording utility reading...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});

			const prevList = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
			);

			const leasesCache = queryClient.getQueryData<LeaseListCache>(
				orpc.rent.lease.listLeases.key(),
			);
			const lease = leasesCache?.leases.find(
				(l) => l.leaseId === variables.leaseId,
			);

			const optimisticItems: UtilityListItem[] = variables.items.map((item) => {
				const unitsUsed = Math.max(
					0,
					item.currentReading - item.previousReading,
				);
				const totalAmount = Math.round(
					unitsUsed * (item.ratePerUnit ?? RATEPERUNIT) +
						(item.fixedCharge ?? FIXEDCHARGE),
				);

				return {
					id: `optimistic-${crypto.randomUUID()}`,
					leaseId: variables.leaseId,
					batchId: variables.batchId,
					utilityType: item.utilityType,
					previousReading: item.previousReading,
					currentReading: item.currentReading,
					unitsUsed,
					ratePerUnit: item.ratePerUnit ?? RATEPERUNIT,
					fixedCharge: item.fixedCharge ?? FIXEDCHARGE,
					totalAmount,
					isPaid: false,
					currentReadingDate: item.currentReadingDate ?? new Date(),
					previousReadingDate: item.previousReadingDate ?? null,
					description: item.description ?? null,
					createdAt: new Date(),
					updatedAt: new Date(),
					// Enriched from lease cache — graceful fallback if cache is cold
					unitNumber: lease?.unitNumber ?? "—",
					propertyName: lease?.propertyName ?? "—",
					tenantName: lease?.tenantName ?? null,
					tenantPhone: lease?.tenantPhone ?? null,
					tenantEmail: lease?.tenantEmail ?? null,
					receiptPaymentId: null,
				};
			});

			queryClient.setQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						utilities: [...optimisticItems, ...old.utilities],
					};
				},
			);

			return { toastId, prevList };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.createUtilityBatch>[0],
		) => client.rent.utility.createUtilityBatch(input),
		onError: (error, _, context) => {
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.utility.listUtilities.key(),
					context.prevList,
				);
			}
			toast.error(`Failed to record utility: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			// WHY: toast only — onSettled handles invalidation on both paths
			toast.success("Utility reading recorded", { id: context.toastId });
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
		},
	});
}

export function useRecordUtilityPayment() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Recording payment...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.utility.recordUtilityPayment>[0],
		) => client.rent.utility.recordUtilityPayment(input),
		onError: (error, __, context) => {
			toast.error(`Failed to record payment: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			toast.success("Payment recorded", { id: context.toastId });
		},
		onSettled: () => {
			// WHY invalidate both: utility's isPaid flips AND a new payment row exists
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
		},
	});
}
