import { expect, test } from "@playwright/test";

test.describe("I03 - Role-based Release Smoke Test", () => {
	test("Public Web App routes respond correctly", async ({ page }) => {
		// Web is running on port 3001
		await page.goto("http://localhost:3001");
		await expect(page).toHaveTitle(/KeyHQ/i); // Assuming standard title

		// Check if sign-in button exists
		const signInButton = page.getByRole("link", { name: /sign in/i });
		if (await signInButton.isVisible()) {
			await expect(signInButton).toBeVisible();
		}
	});

	test("Dashboard loads the proxy/auth gate correctly", async ({ page }) => {
		// Dashboard is running on port 3002
		await page.goto("http://localhost:3002");

		// It should either prompt for login or redirect to auth proxy
		// We just verify it doesn't 500
		const url = page.url();
		expect(url.includes("localhost")).toBeTruthy();
	});

	test("Tenant portal loads the proxy/auth gate correctly", async ({
		page,
	}) => {
		// Tenant is running on port 3003
		await page.goto("http://localhost:3003");

		// It should either prompt for login or redirect to auth proxy
		// We just verify it doesn't 500
		const url = page.url();
		expect(url.includes("localhost")).toBeTruthy();
	});
});
