import env from "@/env";

export const DB_URL =
	env.DB_URL ??
	`postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;

export const DB_SSL = env.NODE_ENV === "production";
