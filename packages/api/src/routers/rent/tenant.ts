// packages/api/src/routers/rent/tenant.ts

import { protectedProcedure } from "@rently/api/procedures";
import { user } from "@rently/db/schema/auth";
import { eq } from "drizzle-orm";
import z from "zod";

const TenantSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	phone: z.string().nullable(),
});

export const listTenants = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant/list" })
	.output(z.object({ tenants: z.array(TenantSchema) }))
	.handler(async ({ context }) => {
		const { db } = context;

		const tenants = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				phone: user.phone,
			})
			.from(user)
			.where(eq(user.role, "tenant"));

		return { tenants };
	});
