import {
	AdminUserDetailResponseSchema,
	AdminUserIdSchema,
	AdminUserListInputSchema,
	AdminUserListResponseSchema,
} from "@rently/validators";
import {
	queryAdminUserDetail,
	queryAdminUsers,
} from "../../modules/admin/users";
import { adminProcedure } from "../../procedures";

export const list = adminProcedure
	.route({ method: "GET", path: "/admin/users" })
	.input(AdminUserListInputSchema)
	.output(AdminUserListResponseSchema)
	.handler(({ context, input }) => queryAdminUsers(context.db, input));

export const get = adminProcedure
	.route({ method: "GET", path: "/admin/users/{userId}" })
	.input(AdminUserIdSchema)
	.output(AdminUserDetailResponseSchema)
	.handler(({ context, input }) =>
		queryAdminUserDetail(context.db, input.userId),
	);
