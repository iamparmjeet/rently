import * as inviteProcedures from "./invite";
import * as leaseProcedures from "./lease";
import * as ownerProfile from "./owner-profile";
import * as paymentProcedures from "./payment";
import * as propertyProcedures from "./property";
import * as receiptProcedures from "./receipt";
import * as statsProcedures from "./stats";
import * as tenantProcedures from "./tenant";
import * as tenantDocumentProcedures from "./tenant-document";
import * as tenantPortalProcedures from "./tenant-portal";
import * as unitProcedures from "./unit";
import * as utilityProcedures from "./utility";

export const rentRouter = {
	property: propertyProcedures,
	unit: unitProcedures,
	lease: leaseProcedures,
	tenant: tenantProcedures,
	invite: inviteProcedures,
	payment: {
		...paymentProcedures,
		getPaymentReceiptData: receiptProcedures.getPaymentReceiptData,
	},
	utility: utilityProcedures,
	stats: statsProcedures,
	ownerProfile,
	tenantPortal: {
		...tenantPortalProcedures,
		getMyPaymentReceiptData: receiptProcedures.getMyPaymentReceiptData,
	},
	tenantDocument: tenantDocumentProcedures,
};
