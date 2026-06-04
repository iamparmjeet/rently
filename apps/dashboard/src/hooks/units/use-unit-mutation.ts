import type { CreateUnit, UnitDetail, UpdateUnit } from "@rently/validators";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// create
export function useCreateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating unit...");
			return { toastId };
		},
		mutationFn: (input: Parameters<typeof client.rent.unit.createUnit>[0]) =>
			client.rent.unit.createUnit(input),
		onSuccess: (_, __, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			toast.success("Unit Created Successfully", { id: context.toastId });
		},
		onError: (error, _, context) => {
			console.error(`Failed to Create Unit: ${error}`);
			toast.error(`Failed to Create Unit: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

// Update
export function useUpdateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Updating unit...");
			return { toastId };
		},
		mutationFn: (input: Parameters<typeof client.rent.unit.updateUnit>[0]) =>
			client.rent.unit.updateUnit(input),

		onSuccess: (_, variables, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Unit Updated Successfully", { id: context.toastId });
		},

		onError: (error, _, context) => {
			console.error("Failed to Update Unit data", error.message);
			toast.error(`Failed to update unit data, ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useDeleteUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Removing unit...");
			return { toastId };
		},
		// The mutationFn receives the property id as its argument
		mutationFn: (input: Parameters<typeof client.rent.unit.deleteUnit>[0]) =>
			client.rent.unit.deleteUnit(input),
		onSuccess: (_, variables, context) => {
			// Invalidate list so the deleted unit disappers and count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			// Also remove the specific unit from cache
			queryClient.removeQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Unit deleted", { id: context.toastId });
		},

		onError: (error, _, context) => {
			toast.error(`${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

// Optimistic
/**
 * ──────────────────────────────────────────────────────────
 * OPTIMISTIC UPDATE PATTERN EXPLAINED
 * ──────────────────────────────────────────────────────────
 *
 * The journey of an optimistic mutation:
 *
 * 1. User submits form
 *    ↓
 * 2. onMutate fires IMMEDIATELY:
 *    - Snapshot current cache (in case we need to roll back)
 *    - Update the cache with optimistic values
 *    - Show loading toast
 *    - Return snapshot + toastId for rollback
 *    ↓
 * 3. mutationFn fires in background (non-blocking):
 *    - Send request to server
 *    - UI is already updated
 *    ↓
 * 4a. onSuccess: Server confirmed our optimism was correct
 *     - Cache is already updated, nothing to do
 *     - Just show success toast
 *
 * 4b. onError: Server rejected, our optimism was wrong
 *     - Restore cache from snapshot
 *     - Show error toast
 *     - UI rolls back to last known-good state
 *
 * WHY: The network is slow (100-500ms). Why make users wait?
 * Update the UI first, ask for permission later. This is how
 * Gmail, Slack, and Google Docs feel so responsive.
 */

type UnitListData = {
	units: {
		id: string;
		deletedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
		propertyId: string;
		unitNumber: string;
		type: "studio" | "shop" | "1BHK" | "2BHK" | "3BHK" | "4BHK";
		area: number | null;
		baseRent: number;
		furnishing: string | null;
		description: string | null;
		status: "available" | "occupied";
		propertyName: string;
		activeLease: {
			id: string;
			tenantId: string;
			tenantName: string | null;
			tenantEmail: string | null;
			rent: number;
			startDate: Date;
			status: "active" | "expired" | "terminated";
		} | null;
	}[];
};

type UpdateUnitInput = {
	id: string;
	data: UpdateUnit;
};

export function useOptimisticCreateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables: CreateUnit) => {
			const toastId = toast.loading("Creating unit...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});

			const previousList = queryClient.getQueryData<UnitListData>(
				orpc.rent.unit.listUnits.key(),
			);

			// FIX: Handle wrapped { units: [...] } shape
			// old.units is the array, not old itself
			queryClient.setQueryData<UnitListData>(
				orpc.rent.unit.listUnits.key(),
				(old) => {
					if (!old) return old;
					return {
						...old, // Keep any other fields (meta, count, etc.)
						units: [
							{
								...variables,
								id: `optimistic-${Date.now()}`,
								status: "available",
								createdAt: new Date(),
								updatedAt: new Date(),
								deletedAt: null,
								// Optional fields
								area: variables.area ?? null,
								furnishing: variables.furnishing ?? null,
								description: variables.description ?? null,
								// Denormalized from property (list query joins this)
								propertyName: "", // Will be replaced on refetch
								// No active lease for new unit
								activeLease: null,
							},
							...old.units, // Prepend to array
						],
					};
				},
			);

			return { toastId, previousList };
		},

		mutationFn: (input: Parameters<typeof client.rent.unit.createUnit>[0]) =>
			client.rent.unit.createUnit(input),

		onError: (error, _, context) => {
			if (context?.previousList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.unit.listUnits.key(),
					context.previousList,
				);
			}
			toast.error(`Failed to create unit: ${error.message}`, {
				id: context?.toastId,
			});
		},

		onSuccess: (_, __, context) => {
			toast.success("Unit created successfully", { id: context.toastId });
		},

		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
		},
	});
}

// UPDATE — optimistic
export function useOptimisticUpdateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables: UpdateUnitInput) => {
			const toastId = toast.loading("Updating unit...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			await queryClient.cancelQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});

			const previousList = queryClient.getQueryData<UnitListData>(
				orpc.rent.unit.listUnits.key(),
			);
			const previousDetail = queryClient.getQueryData<UnitDetail>(
				orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			);

			// FIX: Unwrap { units: [...] }, modify array, rewrap
			queryClient.setQueryData<UnitListData>(
				orpc.rent.unit.listUnits.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						units: old.units.map((unit) =>
							unit.id === variables.id
								? {
										...unit,
										...variables.data, // FIX: Use variables.data, not variables
										updatedAt: new Date(),
									}
								: unit,
						),
					};
				},
			);

			// Update detail cache
			queryClient.setQueryData<UnitDetail>(
				orpc.rent.unit.getUnitById.key({ input: { id: variables.id } }),
				(old) => {
					if (!old || typeof old !== "object") return old;
					return {
						...old,
						...variables.data, // FIX: Use variables.data
						updatedAt: new Date(),
					};
				},
			);

			return { toastId, previousDetail, previousList, id: variables.id };
		},

		// FIX: updateUnit expects { id, data: {...} }
		// Tell TypeScript this mutation function signature
		mutationFn: (input: UpdateUnitInput) => client.rent.unit.updateUnit(input),

		onError: (error, _, context) => {
			if (context?.previousList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.unit.listUnits.key(),
					context.previousList,
				);
			}

			if (context?.previousDetail !== undefined) {
				queryClient.setQueryData(
					orpc.rent.unit.getUnitById.key({
						input: { id: context.id },
					}),
					context.previousDetail,
				);
			}

			toast.error(`Failed to update unit: ${error.message}`, {
				id: context?.toastId,
			});
		},

		onSuccess: (_, __, context) => {
			toast.success("Unit updated successfully", { id: context.toastId });
		},

		onSettled: (_, __, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});
		},
	});
}

// DELETE — optimistic
export function useOptimisticDeleteUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables: { id: string }) => {
			const toastId = toast.loading("Deleting unit...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			await queryClient.cancelQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});

			const prevList = queryClient.getQueryData<UnitListData>(
				orpc.rent.unit.listUnits.key(),
			);
			const prevDetail = queryClient.getQueryData<UnitDetail>(
				orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			);

			// FIX: Unwrap, filter array, rewrap
			queryClient.setQueryData<UnitListData>(
				orpc.rent.unit.listUnits.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						units: old.units.filter((unit) => unit.id !== variables.id),
					};
				},
			);

			// Mark as deleted in detail cache
			queryClient.setQueryData<UnitDetail>(
				orpc.rent.unit.getUnitById.key({ input: { id: variables.id } }),
				(old) => {
					if (!old || typeof old !== "object") return old;
					return {
						...old,
						isDeleted: true,
						deletedAt: new Date(),
					};
				},
			);

			return { toastId, prevList, prevDetail, id: variables.id };
		},

		mutationFn: (input: Parameters<typeof client.rent.unit.deleteUnit>[0]) =>
			client.rent.unit.deleteUnit(input),

		onError: (error, _, context) => {
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.unit.listUnits.key(),
					context.prevList,
				);
			}

			if (context?.prevDetail !== undefined) {
				queryClient.setQueryData(
					orpc.rent.unit.getUnitById.key({
						input: { id: context.id },
					}),
					context.prevDetail,
				);
			}

			toast.error(`Failed to delete unit: ${error.message}`, {
				id: context?.toastId,
			});
		},

		onSuccess: (_, __, context) => {
			toast.success("Unit deleted successfully", { id: context.toastId });
		},

		onSettled: (_, __, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});
		},
	});
}
