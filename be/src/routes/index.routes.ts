import { createRouter } from "@/lib/create-app";
import { success } from "@/utils";

const index = createRouter()
  .get("/health", (c) => c.json({status: "ok" as const}))

// router.get("/health", (c) => {
//   return success(c, { message: "Health Ok" });
// });

export default index;
