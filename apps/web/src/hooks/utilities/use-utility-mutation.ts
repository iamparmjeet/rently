import { onError } from "@orpc/client";
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

// Create
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
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			toast.success("Reading recorded", { id: context.toastId });
		},
	});
}

// Update
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
			console.error(`Failed to update utility: ${error}`);
		},
		onSuccess: (_, variables, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Utility Updated", { id: context.toastId });
		},
	});
}
// Remove
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
			console.error(`Failed to Delete: ${error}`);
			toast.error(`Failed to Delete: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, variables, context) => {
			queryClient.removeQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			toast.success("Utility Deleted successfully.", { id: context.toastId });
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
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			toast.success("Utility bill recorded", { id: context.toastId });
		},
		onError: (error, _, context) => {
			console.error("Failed to create utility batch:", error.message);
			toast.error(`Failed to record bill: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

// ** Suspense
// Create
export function useOptimisticCreateUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Recording utility reading...");

			// Cancel
			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			// Snapshot
			const prevList = queryClient.getQueryData<UtilityListItem>(
				orpc.rent.utility.listUtilities.key(),
			);
			// Optimistic create
			const unitsUsed =
				variables.unitsUsed ??
				variables.currentReading - variables.previousReading;
			const totalAmount =
				(variables.currentReading - variables.previousReading) *
					(variables.ratePerUnit ?? RATEPERUNIT) +
				(variables.fixedCharge ?? FIXEDCHARGE);
			const optimisticRow: UtilityListItem = {
				...variables,
				id: `optimistic-${Date.now()}`,
				batchId: `optimistic-batch-${Date.now()}`,
				ratePerUnit: variables.ratePerUnit ?? RATEPERUNIT,
				unitsUsed,
				fixedCharge: variables.fixedCharge ?? FIXEDCHARGE,
				totalAmount,
				isPaid: variables.isPaid ?? false,
				createdAt: new Date(),
				updatedAt: new Date(),
				readingDate: new Date(),
				previousReadingDate: new Date(),
				unitNumber: "",
				propertyName: "",
				tenantName: null,
				tenantPhone: null,
				tenantEmail: null,
			};

			queryClient.setQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						utilities: [optimisticRow, ...old.utilities],
					};
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
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			toast.success("Reading recorded", { id: context.toastId });
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
		},
	});
}
// Update
export function useOptimisticUpdateUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Updating utility...");
			// cancel both queries,
			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			});
			// Snapshot
			const prevList = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
			);
			const prevDetail = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			);
			// Optimistic update
			queryClient.setQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						utilities: old.utilities.map((u) =>
							u.id === variables.id ? { ...u, variables } : u,
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
			// Rollabck both caches
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
			console.error(`Failed to update utility: ${error}`);
		},
		onSuccess: (_, variables, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: variables.id },
				}),
			});
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
// Remove
export function useOptimisticRemoveUtility() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Deleting utility...");

			// Cancel
			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			// Snapshot
			const prevList = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
			);
			// Optimistic remove
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
			// Rollback the list
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.utility.listUtilities.key(),
					context.prevList,
				);
			}

			console.error(`Failed to Delete: ${error}`);
			toast.error(`Failed to Delete: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			queryClient.removeQueries({
				queryKey: orpc.rent.utility.getUtilityById.key({
					input: { id: context.id },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
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

			// Cancel
			await queryClient.cancelQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			// Snapshot
			const prevList = queryClient.getQueryData<UtilityListCache>(
				orpc.rent.utility.listUtilities.key(),
			);
			// Build Rich list
			const leasesCache = queryClient.getQueryData<LeaseListCache>(
				orpc.rent.lease.listLeases.key(),
			);
			const lease = leasesCache?.leases.find(
				(l) => l.leaseId === variables.leaseId,
			);
			// Optimistic create
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
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
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
		// onError
		onError: (error, __, context) => {
			toast.error(`Failed to record payment: ${error.message}`, {
				id: context?.toastId,
			});
			console.error(`Failed to record payment: ${error}`);
		},
		// onSuccess
		onSuccess: (_, __, context) => {
			// WHY invalidate both: the utility's isPaid flips, and a new payment row exists
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			toast.success("Payment recorded", { id: context.toastId });
		},
	});
}
