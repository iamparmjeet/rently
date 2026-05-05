// import type { AppType } from "be";

import type { AppType } from "be";
import { type ClientResponse, hc } from "hono/client";
import { env } from "@/env";
import { ApiError } from "@/types/api-types";

export const client = hc<AppType>(env.NEXT_PUBLIC_API_URL, {
	init: {
		credentials: "include",
	},
});

// Helper - BE error responses into ApiError instances
// usethis in onError callback of every useQuery/useMutation
export async function parseApiError(response: Response): Promise<ApiError> {
	try {
		const body = await response.json();
		return new ApiError(
			body.message ?? "Request Failed",
			response.status,
			body.details,
		);
	} catch {
		return new ApiError("Request Failed", response.status);
	}
}

// Helper - unwrap a successful hono client response
export async function unwrap<T>(
	responsePromise: Promise<ClientResponse<unknown, number, string>>,
): Promise<T> {
	const response = await responsePromise;

	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({
			message: "Unknown Error",
			status: response.status,
		}));
		throw errorBody;
	}
	return response.json() as T;
}
