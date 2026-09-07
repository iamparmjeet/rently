import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// H01: the printable page renders only what this statement returns — the
// bill composition (one lease, one month) and every amount are server-issued.
export function useBillStatement(statementId: string) {
	return useQuery({
		...orpc.rent.statement.getBillStatement.queryOptions({
			input: { id: statementId },
		}),
		enabled: statementId.length > 0,
		retry: false,
	});
}

export function useIssueBillStatement() {
	return useMutation(
		orpc.rent.statement.issueBillStatement.mutationOptions({}),
	);
}
