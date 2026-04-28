import createApp from "@/lib/create-app";
import index from "@/routes/index.routes";
import rentRoutes from "@/routes/rent/routes";
import subscriptionRoutes from "@/routes/subscriptions/routes";

const app = createApp()
  .route("/api/v1", index)
  .route("/api/v1", rentRoutes)
  .route("/api/v1", subscriptionRoutes)

// export type AppType = (typeof routes)[number];
export type AppType = typeof app
export default app;
