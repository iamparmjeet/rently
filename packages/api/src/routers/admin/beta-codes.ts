import {
	AdminBetaCodeListInputSchema,
	AdminBetaCodeListResponseSchema,
	AdminBetaCodeSchema,
	CreateAdminBetaCodeSchema,
	ExpireAdminBetaCodeSchema,
} from "@rently/validators";
import z from "zod";
import {
	createAdminBetaCode,
	expireAdminBetaCode,
	queryAdminBetaCodes,
} from "../../modules/admin/beta-codes";
import { adminProcedure } from "../../procedures";

export const list = adminProcedure
	.route({ method: "GET", path: "/admin/beta-codes" })
	.input(AdminBetaCodeListInputSchema)
	.output(AdminBetaCodeListResponseSchema)
	.handler(({ context, input }) => queryAdminBetaCodes(context.db, input));

export const create = adminProcedure
	.route({ method: "POST", path: "/admin/beta-codes" })
	.input(CreateAdminBetaCodeSchema)
	.output(z.object({ betaCode: AdminBetaCodeSchema }))
	.handler(({ context, input }) =>
		createAdminBetaCode(context.db, context.user.id, input),
	);

export const expire = adminProcedure
	.route({ method: "POST", path: "/admin/beta-codes/{betaCodeId}/expire" })
	.input(ExpireAdminBetaCodeSchema)
	.output(z.object({ success: z.literal(true) }))
	.handler(({ context, input }) =>
		expireAdminBetaCode(context.db, context.user.id, input),
	);
