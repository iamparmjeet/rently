import * as inviteProcedures from "./invite";
import * as leaseProcedures from "./lease";
import * as paymentProcedures from "./payment";
import * as propertyProcedures from "./property";
import * as tenantProcedures from "./tenant";
import * as unitProcedures from "./unit";
import * as utilityProcedures from "./utility";

export const rentRouter = {
	property: propertyProcedures,
	unit: unitProcedures,
	lease: leaseProcedures,
	tenant: tenantProcedures,
	invite: inviteProcedures,
	payment: paymentProcedures,
	utility: utilityProcedures,
};
