import { USER_ROLES } from "@/constants/user-roles";
import { createRouter } from "@/lib/create-app";
import withAuth from "@/middleware/auth-middleware";
import requireRole from "@/middleware/require-role";
import { subscriptionHandler } from "./handlers";

const router = createRouter();

router.use(withAuth());
router.use(requireRole(USER_ROLES.OWNER));

router.post("/subscriptions/start-trial", subscriptionHandler.startTrial);
router.post("/subscriptions/upgrade", subscriptionHandler.upgrade);

export default router;
