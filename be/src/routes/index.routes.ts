import { createRouter } from "@/lib/create-app";
import { StatusCode } from "@/utils";

const router = createRouter();

router.get("/health", (c) => {
  return c.json({
    message: "Hello World",
    status: StatusCode.OK,
  });
});

export default router;
