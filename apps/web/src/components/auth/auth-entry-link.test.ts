import { describe, expect, it } from "vitest";
import { AuthEntryLink } from "./auth-entry-link";

describe("AuthEntryLink", () => {
	it("uses a document navigation so middleware can redirect across apps", () => {
		const element = AuthEntryLink({ href: "/login", children: "Log in" });

		expect(element.type).toBe("a");
	});
});
