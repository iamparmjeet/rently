// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIdempotencyKey } from "./form-dialog";

// B07: one UUID per dialog open — stable across rerenders and retries,
// fresh on reopen, absent when closed.
describe("useIdempotencyKey", () => {
	it("returns null while closed", () => {
		const { result } = renderHook(({ open }) => useIdempotencyKey(open), {
			initialProps: { open: false },
		});
		expect(result.current).toBeNull();
	});

	it("keeps the same key across rerenders while open", () => {
		const { result, rerender } = renderHook(
			({ open }) => useIdempotencyKey(open),
			{ initialProps: { open: false } },
		);
		rerender({ open: true });
		const first = result.current;
		expect(first).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		rerender({ open: true });
		rerender({ open: true });
		expect(result.current).toBe(first);
	});

	it("mints a fresh key on reopen", () => {
		const { result, rerender } = renderHook(
			({ open }) => useIdempotencyKey(open),
			{ initialProps: { open: false } },
		);
		rerender({ open: true });
		const first = result.current;
		rerender({ open: false });
		expect(result.current).toBeNull();
		rerender({ open: true });
		expect(result.current).not.toBeNull();
		expect(result.current).not.toBe(first);
	});
});
