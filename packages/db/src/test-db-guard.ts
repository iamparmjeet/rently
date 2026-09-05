// A04: destructive tests/migrations may run only against the rently_test
// database on an approved host (local Docker by default, plus explicitly
// allowlisted ephemeral hosts). Dependency-free so drizzle-kit config
// loading can import it alongside vitest.
const LOCAL_TEST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getAllowedTestHosts(): string[] {
	const extra = (process.env.RENTRY_TEST_EXTRA_HOSTS ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter((host) => host.length > 0);
	return [...LOCAL_TEST_HOSTS, ...extra];
}

export function isAllowedTestDatabaseUrl(value: string | undefined): boolean {
	if (!value) return false;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.pathname !== "/rently_test") return false;
	return getAllowedTestHosts().includes(url.hostname);
}

export function assertAllowedTestDatabaseUrl(
	value: string | undefined,
	context: string,
): void {
	if (!isAllowedTestDatabaseUrl(value)) {
		throw new Error(
			`${context}: refusing — expected the rently_test database on an approved host (localhost by default, or RENTRY_TEST_EXTRA_HOSTS).`,
		);
	}
}
