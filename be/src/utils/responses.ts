// src/lib/responses.ts

import type { Context } from "hono";
import { StatusCode, StatusPhrase } from "@/utils/http";

/**
 * Generic error response helper
 */
export function sendError(
  c: Context,
  message: string,
  statusCode: number
): Response {
  return c.json({ error: message }, statusCode);
}

/**
 * Unauthorized access response
 */
export function unauthorized(
  c: Context,
  message = StatusPhrase.UNAUTHORIZED
): Response {
  return sendError(c, message, StatusCode.UNAUTHORIZED);
}

/**
 * Forbidden action response
 */
export function forbidden(
  c: Context,
  message = StatusPhrase.FORBIDDEN
): Response {
  return sendError(c, message, StatusCode.FORBIDDEN);
}

/**
 * Bad Request with optional details
 */
export function badRequest(
  c: Context,
  message = StatusPhrase.BAD_REQUEST,
  details?: unknown
): Response {
  const payload: { error: string; details?: unknown } = { error: message };
  if (details) payload.details = details;
  return c.json(payload, StatusCode.BAD_REQUEST);
}

/**
 * Success with data
 */
export function success(c: Context, data?: Record<string, unknown>): Response {
  return c.json({ success: true, ...data }, StatusCode.OK);
}

/**
 * Created resource response
 */
export function created(c: Context, data?: Record<string, unknown>): Response {
  return c.json({ success: true, ...data }, StatusCode.CREATED);
}
