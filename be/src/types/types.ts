import type { PinoLogger } from "hono-pino";
import z from "zod";
import type { Environment } from "@/env";

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    logger: PinoLogger;
  };
}

export const IdParamsSchema = z.object({
  id: z.coerce.number(),
});
