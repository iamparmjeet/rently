import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { StatusCode, StatusPhrase } from "@/utils";

// safe sendError

export function safeError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return "[Unserializable Object]";
    }
  }
  return String(error);
}

/** - Generic error response helper with optional extra fields (like details) */

export function sendError(
  c: Context,
  message: string,
  statusCode: ContentfulStatusCode,
  extras?: Record<string, unknown>
): Response {
  const payload = { error: message, ...extras };
  return c.json(payload, statusCode);
}

/** - Unauthorized access response */

export function unauthorized(
  c: Context,
  message = StatusPhrase.UNAUTHORIZED,
  extras?: Record<string, unknown>
): Response {
  return sendError(c, message, StatusCode.UNAUTHORIZED, extras);
}

/** - Forbidden action response */

export function forbidden(
  c: Context,
  message = StatusPhrase.FORBIDDEN,
  extras?: Record<string, unknown>
): Response {
  return sendError(c, message, StatusCode.FORBIDDEN, extras);
}

/** - Bad Request with optional details */

export function badRequest(
  c: Context,
  message?: string,
  details?: unknown
): Response;

export function badRequest(
  c: Context,
  options: {
    message?: string;
    details?: unknown;
    context?: Record<string, unknown>;
  }
): Response;

export function badRequest(
  c: Context,
  messageOrOptions?:
    | string
    | {
        message?: string;
        details?: unknown;
        context?: Record<string, unknown>;
      },
  details?: unknown
): Response {
  let message: string = StatusPhrase.BAD_REQUEST;
  let payloadDetails: unknown;
  let context: Record<string, unknown> | undefined;

  if (typeof messageOrOptions === "string") {
    message = messageOrOptions;
    payloadDetails = details;
  } else if (messageOrOptions && typeof messageOrOptions === "object") {
    const opts = messageOrOptions;
    if (opts.message) message = opts.message;
    if (opts.details) payloadDetails = opts.details;
    if (opts.context) context = opts.context;
  }

  // Optionally log context here if using pino or internal logger
  if (context) {
    console.warn("[BAD_REQUEST]", { message, context });
  }

  return sendError(
    c,
    message,
    StatusCode.BAD_REQUEST,
    payloadDetails ? { details: payloadDetails } : undefined
  );
}

/** - Success response with optional data */

export function success(
  c: Context,

  data?: Record<string, unknown>,

  statusCode?: ContentfulStatusCode
): Response;

export function success(
  c: Context,

  options: {
    message?: string;

    data?: Record<string, unknown>;
  },

  statusCode?: ContentfulStatusCode
): Response;

export function success(
  c: Context,

  dataOrOptions?:
    | Record<string, unknown>
    | { message?: string; data?: Record<string, unknown> },

  statusCode: ContentfulStatusCode = StatusCode.OK
): Response {
  const payload: Record<string, unknown> = { success: true };

  if (dataOrOptions && typeof dataOrOptions === "object") {
    if ("message" in dataOrOptions || "data" in dataOrOptions) {
      const options = dataOrOptions as {
        message?: string;

        data?: Record<string, unknown>;
      };

      if (options.message) payload.message = options.message;

      if (options.data) Object.assign(payload, options.data);
    } else {
      Object.assign(payload, dataOrOptions);
    }
  }

  return c.json(payload, statusCode);
}

/** - Created resource response */

export function created(c: Context, data?: Record<string, unknown>): Response {
  return success(c, data, StatusCode.CREATED);
}

/** - No Content response */

export function noContent(c: Context): Response {
  return c.body(null, StatusCode.NO_CONTENT);
}

/**
 * Not Found response with optional structured input like success()
 */
export function notFound(
  c: Context,
  message?: string,
  details?: unknown
): Response;

export function notFound(
  c: Context,
  options: {
    message?: string;
    details?: unknown;
    context?: Record<string, unknown>;
  }
): Response;

export function notFound(
  c: Context,
  messageOrOptions?:
    | string
    | {
        message?: string;
        details?: unknown;
        context?: Record<string, unknown>;
      },
  details?: unknown
): Response {
  let message: string = StatusPhrase.NOT_FOUND;
  let payloadDetails: unknown;
  let context: Record<string, unknown> | undefined;

  if (typeof messageOrOptions === "string") {
    message = messageOrOptions;
    payloadDetails = details;
  } else if (messageOrOptions && typeof messageOrOptions === "object") {
    const opts = messageOrOptions;
    if (opts.message) message = opts.message;
    if (opts.details) payloadDetails = opts.details;
    if (opts.context) context = opts.context;
  }

  // Optionally log the context for debugging (you can plug in pino here)
  if (context) {
    console.warn("[NOT_FOUND]", { message, context });
  }

  return sendError(
    c,
    message,
    StatusCode.NOT_FOUND,
    payloadDetails ? { details: payloadDetails } : undefined
  );
}
