import type { Ctx } from "@/types/types";
import { StatusCode, safeError, sendError } from "@/utils";

export const safeHandler =
  (fn: (c: Ctx) => Promise<Response>) => async (c: Ctx) => {
    try {
      return await fn(c);
    } catch (err) {
      console.error("Handler Error", safeError(err));
      return sendError(
        c,
        "Internal Server Error",
        StatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };

export default safeHandler;
