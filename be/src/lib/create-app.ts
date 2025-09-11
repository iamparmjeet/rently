import { Hono } from "hono";
import { parseEnv } from "@/env";
import { notFound, onError, pinoLogger } from "@/middleware";
import type { AppBindings } from "@/types/types";
import { serveEmojiFavicon } from "@/utils";
import auth from "./auth-cli";

export function createRouter() {
  return new Hono<AppBindings>({
    strict: false,
  });
}

export default function createApp() {
  const app = createRouter();
  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  app.use((c, next) => {
    c.env = parseEnv(Object.assign(c.env || {}, process.env));
    return next();
  });
  app.use(serveEmojiFavicon("⛳"));
  app.use(pinoLogger());

  app.notFound(notFound);
  app.onError(onError);
  return app;
}
