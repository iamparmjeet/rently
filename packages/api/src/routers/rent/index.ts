import * as leaseProcedures from "./lease";
import * as propertyProcedures from "./property";
import * as tenantProcedures from "./tenant";
import * as unitProcedures from "./unit";

export const rentRouter = {
	property: propertyProcedures,
	unit: unitProcedures,
	lease: leaseProcedures,
	tenant: tenantProcedures,
};
