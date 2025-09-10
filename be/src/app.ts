import createApp from "@/lib/create-app";
import index from "@/routes/index.routes";

const app = createApp();

const routes = [index];
routes.forEach((route) => {
  app.route("/api", route);
});

export type AppType = (typeof routes)[number];

export default app;
