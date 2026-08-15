import {
	AdminAuditLogListInputSchema,
	AdminAuditLogListResponseSchema,
} from "@rently/validators";
import { queryAdminAuditLogs } from "../../modules/admin/audit-logs";
import { adminProcedure } from "../../procedures";

export const list = adminProcedure
	.route({ method: "GET", path: "/admin/audit-logs" })
	.input(AdminAuditLogListInputSchema)
	.output(AdminAuditLogListResponseSchema)
	.handler(({ context, input }) => queryAdminAuditLogs(context.db, input));
