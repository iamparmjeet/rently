import { describe, expect, it } from "vitest";
import { usesNeonDriver } from "./database-driver";

describe("usesNeonDriver", () => {
	it("uses node-postgres for the local Docker database", () => {
		expect(
			usesNeonDriver(
				"postgresql://rently_db_user:password@localhost:5432/rently_dev",
			),
		).toBe(false);
	});

	it("uses Neon HTTP for a Neon database URL", () => {
		expect(
			usesNeonDriver(
				"postgresql://user:password@ep-example.ap-southeast-1.aws.neon.tech/neondb",
			),
		).toBe(true);
	});

	it("does not select Neon from text outside the hostname", () => {
		expect(
			usesNeonDriver(
				"postgresql://neon.tech:password@localhost:5432/rently_dev",
			),
		).toBe(false);
	});
});
