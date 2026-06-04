import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation";

export const { withEvlog, useLogger, log, createError } = createEvlog({
	service: "rently-tenant",
});

export const { register, onRequestError } = createInstrumentation({
	service: "rently-tenant",
});
