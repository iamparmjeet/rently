import { createRouter } from "@/lib/create-app";
import { success } from "@/utils";

const router = createRouter();

router.get("/health", (c) => {
  return success(c, { message: "Health Ok" });
});

export default router;
