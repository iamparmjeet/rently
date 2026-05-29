// src/constants/redirect-errors.ts

// These are the values that appear in ?error= query params on redirects.
// Centralised here so proxy.ts and the guard component stay in sync.
export const REDIRECT_ERRORS = {
	unauthorized_access: "That section is for property owners only.",
	session_expired: "Your session expired. Please log in again.",
} as const;

// Derive the union type from the keys — never write this manually
export type RedirectErrorKey = keyof typeof REDIRECT_ERRORS;
