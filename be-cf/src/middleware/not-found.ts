import type { NotFoundHandler } from "hono";
import { StatusCode, StatusPhrase } from "@/utils/http";

const notFound: NotFoundHandler = (c) => {
  return c.json(
    {
      message: `${StatusPhrase.NOT_FOUND} - ${c.req.path}`,
    },
    StatusCode.NOT_FOUND
  );
};

export default notFound;
