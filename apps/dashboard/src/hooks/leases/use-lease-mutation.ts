import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

function getLeaseUpdateErrorMessage(message: string) {
	return message === "Internal Server Error"
		? "Unable to update the lease. Please try again."
		: message;
}

// Create
export function useCreateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Lease creating...");
			return { toastId };
		},
		// client.property.create is fully typed — TypeScript knows the input shape
		mutationFn: (input: Parameters<typeof client.rent.lease.createLease>[0]) =>
			client.rent.lease.createLease(input),

		onSuccess: (_, __, context) => {
			// Invalidate the list so properties page re-fetches
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			toast.success("Lease created successfully", { id: context.toastId });
		},

		onError: (error, _, context) => {
			console.error("Failed to create lease:", error.message);
			toast.error(`Failed to create lease: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useCreateCombinedLease() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.rent.lease.createCombinedLease>[0],
		) => client.rent.lease.createCombinedLease(input),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			toast.success("Combined lease created successfully");
		},
		onError: (error) =>
			toast.error(`Failed to create combined lease: ${error.message}`),
	});
}

// Update
export function useUpdateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Lease updating...");
			return { toastId };
		},
		mutationFn: (input: Parameters<typeof client.rent.lease.updateLease>[0]) =>
			client.rent.lease.updateLease(input),

		onSuccess: (_, variables, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.getLeaseById.key({
					input: { id: variables.id },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key(),
			});
			toast.success("Lease Updated Successfully", { id: context.toastId });
		},

		onError: (error, _, context) => {
			console.error("Failed to Update Lease data", error.message);
			toast.error(getLeaseUpdateErrorMessage(error.message), {
				id: context?.toastId,
			});
		},
	});
}

export function useTerminateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Terminating lease...");
			return { toastId };
		},
		// The mutationFn receives the property id as its argument
		mutationFn: (
			input: Parameters<typeof client.rent.lease.terminateLease>[0],
		) => client.rent.lease.terminateLease(input),
		onSuccess: (_, __, context) => {
			// removeQueries = clear cache without refetching
			// invalidateQueries = clear + immediately trigger refetch
			// For delete, we just want to clear — nothing to refetch
			// queryClient.removeQueries({
			// 	queryKey: orpc.rent.lease.listLease.key(),
			// });

			// Invalidate list so count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});

			toast.success("Lease terminated", { id: context.toastId });
		},

		onError: (error, _, context) => {
			toast.error(`Failed to terminate lease: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key(),
			});
		},
	});
}

export function useRentReminderSuppression(leaseId: string) {
	return useQuery({
		...orpc.rent.lease.getNextRentReminderSuppression.queryOptions({
			input: { leaseId },
		}),
		enabled: !!leaseId,
	});
}

export function useSuppressNextRentReminders() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.rent.lease.suppressNextRentReminders>[0],
		) => client.rent.lease.suppressNextRentReminders(input),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.getNextRentReminderSuppression.key({
					input: { leaseId: variables.leaseId },
				}),
			});
			toast.success("Next month’s rent reminders skipped");
		},
		onError: (error) => toast.error(error.message),
	});
}

export function useResumeNextRentReminders() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.rent.lease.resumeNextRentReminders>[0],
		) => client.rent.lease.resumeNextRentReminders(input),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.getNextRentReminderSuppression.key({
					input: { leaseId: variables.leaseId },
				}),
			});
			toast.success("Next month’s rent reminders resumed");
		},
		onError: (error) => toast.error(error.message),
	});
}

// Optimistic Hooks
type LeaseListData = Awaited<ReturnType<typeof client.rent.lease.listLeases>>;

export function useOptimisticCreateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Lease creating...");

			// Cancel
			await queryClient.cancelQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});

			// Snapshot for roolabck
			const prevList = queryClient.getQueryData<LeaseListData>(
				orpc.rent.lease.listLeases.key(),
			);

			// Optimistic prepend the list
			queryClient.setQueryData<LeaseListData>(
				orpc.rent.lease.listLeases.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						leases: [
							{
								leaseId: `optimistic-${Date.now()}`,
								agreementId: null,
								tenantId: variables.tenantId,
								rent: variables.rent,
								deposit: variables.deposit ?? null,
								startDate: variables.startDate,
								endDate: variables.endDate ?? null,
								unitId: variables.unitId,
								status: "active",
								rentDueDate: variables.rentDueDate ?? null,
								tenantName: null,
								tenantPhone: null,
								tenantEmail: null,
								unitNumber: "",
								propertyName: "",
								propertyId: "",
								createdAt: new Date(),
								updatedAt: new Date(),
								referenceId: "",
							},
							...old.leases,
						],
					};
				},
			);

			return { toastId, prevList };
		},
		// client.property.create is fully typed — TypeScript knows the input shape
		mutationFn: (input: Parameters<typeof client.rent.lease.createLease>[0]) =>
			client.rent.lease.createLease(input),
		// onError
		onError: (error, _, context) => {
			// Roolback
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.lease.listLeases.key(),
					context.prevList,
				);
			}
			console.error("Failed to create lease:", error.message);
			toast.error(`Failed to create lease: ${error.message}`, {
				id: context?.toastId,
			});
		},
		// onSuccess
		onSuccess: (_, __, context) => {
			// Invalidate the list so properties page re-fetches
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			toast.success("Lease created successfully", { id: context.toastId });
		},
		// onSettled
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
		},
	});
}

export function useOptimisticUpdateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Lease updating...");

			// cancel both catches
			await queryClient.cancelQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			await queryClient.cancelQueries({
				queryKey: orpc.rent.lease.getLeaseById.key({
					input: { id: variables.id },
				}),
			});

			// Snapshot
			const prevList = queryClient.getQueryData<LeaseListData>(
				orpc.rent.lease.listLeases.key(),
			);
			const prevDetail = queryClient.getQueryData(
				orpc.rent.lease.getLeaseById.key({
					input: { id: variables.id },
				}),
			);

			// Optimistic Update - list
			queryClient.setQueryData<LeaseListData>(
				orpc.rent.lease.listLeases.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						leases: old.leases.map((l) =>
							l.leaseId === variables.id ? { ...l, ...variables } : l,
						),
					};
				},
			);

			// Optimistic Update prevDetail
			queryClient.setQueryData<LeaseListData>(
				orpc.rent.lease.getLeaseById.key({ input: { id: variables.id } }),
				(old) => {
					if (!old || typeof old !== "object") return old;
					return { ...old, ...variables };
				},
			);

			return { toastId, prevDetail, prevList, id: variables.id };
		},
		mutationFn: (input: Parameters<typeof client.rent.lease.updateLease>[0]) =>
			client.rent.lease.updateLease(input),

		// onError
		onError: (error, _, context) => {
			// rollback
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.lease.listLeases.key(),
					context.prevList,
				);
			}
			if (context?.prevDetail !== undefined) {
				queryClient.setQueryData(
					orpc.rent.lease.getLeaseById.key({
						input: { id: context.id },
					}),
					context.prevDetail,
				);
			}
			console.error("Failed to Update Lease data", error.message);
			toast.error(getLeaseUpdateErrorMessage(error.message), {
				id: context?.toastId,
			});
		},
		// onSuccess
		onSuccess: (_, variables, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.getLeaseById.key({
					input: { id: variables.id },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key(),
			});
			toast.success("Lease Updated Successfully", { id: context.toastId });
		},
		// onSettled
		onSettled: (_, __, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.getLeaseById.key({
					input: { id: variables.id },
				}),
			});
		},
	});
}

export function useOptimisticTerminateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Terminating lease...");
			// Cancel
			await queryClient.cancelQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			// Snapshot
			const prevList = queryClient.getQueryData<LeaseListData>(
				orpc.rent.lease.listLeases.key(),
			);
			// Optimistic remove from list
			queryClient.setQueryData<LeaseListData>(
				orpc.rent.lease.listLeases.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						leases: old.leases.filter((l) => l.leaseId !== variables.id),
					};
				},
			);

			return { toastId, prevList, id: variables.id };
		},
		// The mutationFn receives the property id as its argument
		mutationFn: (
			input: Parameters<typeof client.rent.lease.terminateLease>[0],
		) => client.rent.lease.terminateLease(input),
		// onError
		onError: (error, _, context) => {
			// Rollback the list
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.lease.listLeases.key(),
					context.prevList,
				);
			}
			toast.error(`Failed to terminate lease: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, variables, context) => {
			// Invalidate list so count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.getLeaseById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Lease terminated", { id: context.toastId });
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key(),
			});
		},
	});
}
