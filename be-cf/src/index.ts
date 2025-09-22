import { serve } from "@hono/node-server";
import app from "./app";
import env from "./env";

const port = Number(env.PORT || 8787);
console.log("running on port", port);

serve({
  fetch: app.fetch,
  port,
});
