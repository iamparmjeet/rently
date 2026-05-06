export interface ApiSuccessResponse<T = Record<string, unknown>> {
	success: true;
	data?: T;
	message?: string;
}

export interface ApiErrorResponse {
	success: false;
	message: string;
	details?: unknown;
}

export class ApiError extends Error {
	constructor(
		message: string,
		public statusCode: number,
		public details?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}
