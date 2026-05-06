import { USER_ROLES } from "@/constants/user-roles";
import { createRouter } from "@/lib/create-app";
import withAuth from "@/middleware/auth-middleware";
import requireRole from "@/middleware/require-role";
import { subscriptionHandler } from "./handlers";

const subscriptionsRoutes = createRouter()
.use(withAuth())
.use(requireRole(USER_ROLES.OWNER))
.post("/subscriptions/start-trial", subscriptionHandler.startTrial)
.post("/subscriptions/upgrade", subscriptionHandler.upgrade)

export default subscriptionsRoutes;
