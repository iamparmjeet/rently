import { USER_ROLES } from "@/constants/user-roles";
import { createRouter } from "@/lib/create-app";
import withAuth from "@/middleware/auth-middleware";
import requireRole from "@/middleware/require-role";
import { propertyHandlers } from "./handlers";

const router = createRouter();

// Middleware for Owner and auth
router.use(withAuth());
router.use(requireRole(USER_ROLES.OWNER));

// Properties
router.post("/properties", propertyHandlers.create);
router.get("/properties", propertyHandlers.getAll);
router.get("/properties/:id", propertyHandlers.getById);
router.put("/properties/:id", propertyHandlers.update);
router.delete("/properties/:id", propertyHandlers.remove);

// Units
// Leases
// Utilities
// Payments

export default router;
