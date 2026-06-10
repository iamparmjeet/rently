const SESSION_COOKIE = "rently.session_token";
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

export function hasSessionCookie(request: Request): boolean {
	const header = request.headers.get("cookie") ?? "";
	return (
		header.includes(`${SECURE_SESSION_COOKIE}=`) ||
		header.includes(`${SESSION_COOKIE}=`)
	);
}
