import { USER_ROLES } from "@/constants/user-roles";
import { createRouter } from "@/lib/create-app";
import withAuth from "@/middleware/auth-middleware";
import requireRole from "@/middleware/require-role";
import { inviteHandlers, leaseHandlers, propertyHandlers } from "./handlers";

const router = createRouter();

// Middleware for Owner and auth
router.use(withAuth());
router.use(requireRole(USER_ROLES.OWNER));

// Invites
router.post("/tenant-invites", inviteHandlers.handleCreateInvite);
router.post("/tenant-invites/accept", inviteHandlers.handleAcceptInvite);

// Properties
router.post("/properties", propertyHandlers.create);
router.get("/properties", propertyHandlers.getAll);
router.get("/properties/:id", propertyHandlers.getById);
router.put("/properties/:id", propertyHandlers.update);
router.delete("/properties/:id", propertyHandlers.remove);

// Leases
router.post("/leases", leaseHandlers.create);
router.get("/leases", leaseHandlers.getAll);
router.get("/leases/:leaseId", leaseHandlers.getbyId);
router.put("/leases:/leaseId", leaseHandlers.update);
router.delete("/leases:/leaseId", leaseHandlers.remove);

// Units
// Utilities
// Payments

export default router;
