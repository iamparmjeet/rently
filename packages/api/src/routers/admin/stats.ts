import { AdminOverviewSchema } from "@rently/validators";
import { queryAdminOverview } from "../../modules/admin/overview";
import { adminProcedure } from "../../procedures";

export const getOverview = adminProcedure
	.route({ method: "GET", path: "/admin/stats/overview" })
	.output(AdminOverviewSchema)
	.handler(({ context }) => queryAdminOverview(context.db));
