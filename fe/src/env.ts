import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    BETTER_AUTH_URL: z.url(),
  },
  client: {
    NEXT_PUBLIC_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: {
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		NEXT_PUBLIC_PUBLISHABLE_KEY: ""
  },

});
