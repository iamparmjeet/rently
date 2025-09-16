import { type Context, Hono } from "hono";
import {db} from "@/db";
import { parseEnv } from "@/env";
import { notFound, onError, pinoLogger } from "@/middleware";
import type { AppBindings } from "@/types/types";
import { serveEmojiFavicon } from "@/utils";
import { auth } from "./auth";

export function createRouter() {
  return new Hono<AppBindings>({
    strict: false,
  });
}

export default function createApp() {
  const app = createRouter();
  app.use((c, next) => {
    // biome-ignore lint/style/noProcessEnv: "Only Here"
    c.env = parseEnv(Object.assign(c.env || {}, process.env));
    return next();
  });

  app.use(pinoLogger());
  app.use(serveEmojiFavicon("⛳"));

  app.on(["POST", "GET"], "/api/auth/*", (c: Context) => {
    // const auth = createAuth();
    return auth.handler(c.req.raw);
  });

  app.notFound(notFound);
  app.onError(onError);
  return app;
}
