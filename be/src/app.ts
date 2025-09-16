import createApp from "@/lib/create-app";
import index from "@/routes/index.routes";
import rentRoutes from "@/routes/rent/routes";

const app = createApp();

const routes = [index, rentRoutes];
routes.forEach((route) => {
  app.route("/api/v1", route);
});

export type AppType = (typeof routes)[number];

export default app;
