/** Selects the database transport from the single configured database URL. */
export function usesNeonDriver(databaseUrl: string): boolean {
	const hostname = new URL(databaseUrl).hostname;
	return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
}
