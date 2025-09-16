import env from "@/env";

export const DB_URL = `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@localhost:5432/${env.DB_NAME}`;
