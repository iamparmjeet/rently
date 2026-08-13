import * as auditLogProcedures from "./audit-logs";
import * as betaCodeProcedures from "./beta-codes";
import * as statsProcedures from "./stats";
import * as subscriptionProcedures from "./subscriptions";
import * as userProcedures from "./users";

export const adminRouter = {
	stats: statsProcedures,
	users: userProcedures,
	subscriptions: subscriptionProcedures,
	betaCodes: betaCodeProcedures,
	auditLogs: auditLogProcedures,
};
