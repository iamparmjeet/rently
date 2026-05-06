import { zValidator } from "@hono/zod-validator";
import { USER_ROLES } from "@/constants/user-roles";
import { createRouter } from "@/lib/create-app";
import withAuth from "@/middleware/auth-middleware";
import requireRole from "@/middleware/require-role";
import {
	CreateLeaseSchema,
	CreatePaymentSchema,
	CreatePropertySchema,
	CreateUnitSchmea,
	CreateUtilitySchema,
	UpdateLeaseSchema,
	UpdatePaymentSchema,
	UpdatePropertySchema,
	UpdateUnitSchema,
	UpdateUtilitySchema,
} from "@/types/rent-types";
import {
	inviteHandlers,
	leaseHandlers,
	paymentsHandlers,
	propertyHandlers,
	unitHandlers,
	utilityHandlers,
} from "./handlers";

const rentRoutes = createRouter()
	.use(withAuth())
	.use(requireRole(USER_ROLES.OWNER))
	// Invites
	.post("/tenant-invites", inviteHandlers.handleCreateInvite)
	.post("/tenant-invites/accept", inviteHandlers.handleAcceptInvite)
	// Properties
	.post(
		"/properties",
		zValidator("json", CreatePropertySchema),
		propertyHandlers.create,
	)
	.get("/properties/:id/units", propertyHandlers.getPropertyUnits)
	.get("/properties", propertyHandlers.getAll)
	.get("/properties/:id", propertyHandlers.getById)
	.put(
		"/properties/:id",
		zValidator("json", UpdatePropertySchema),
		propertyHandlers.update,
	)
	.delete("/properties/:id", propertyHandlers.remove)
	// Leases
	.post("/leases", zValidator("json", CreateLeaseSchema), leaseHandlers.create)
	.get("/leases", leaseHandlers.getAll)
	.get("/leases/:id", leaseHandlers.getbyId)
	.put(
		"/leases/:id",
		zValidator("json", UpdateLeaseSchema),
		leaseHandlers.update,
	)
	.delete("/leases/:id", leaseHandlers.remove)
	// Units
	.post("/units", zValidator("json", CreateUnitSchmea), unitHandlers.create)
	.get("/units", unitHandlers.getAll)
	.get("/units/:id", unitHandlers.getById)
	.put("/units/:id", zValidator("json", UpdateUnitSchema), unitHandlers.update)
	.delete("/units/:id", unitHandlers.remove)
	// Utilities
	.post(
		"/utilities",
		zValidator("json", CreateUtilitySchema),
		utilityHandlers.create,
	)
	.get("/utilities", utilityHandlers.getAll)
	.get("/utilities/:id", utilityHandlers.getById)
	.put(
		"/utilities/:id",
		zValidator("json", UpdateUtilitySchema),
		utilityHandlers.update,
	)
	.delete("/utilities/:id", utilityHandlers.remove)
	// Payments
	.post(
		"/payments",
		zValidator("json", CreatePaymentSchema),
		paymentsHandlers.create,
	)
	.get("/payments", paymentsHandlers.getAll)
	.get("/payments/:id", paymentsHandlers.getById)
	.put(
		"/payments/:id",
		zValidator("json", UpdatePaymentSchema),
		paymentsHandlers.update,
	)
	.delete("/payments/:id", paymentsHandlers.remove);

export default rentRoutes;
