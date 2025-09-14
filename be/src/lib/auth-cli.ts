import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { createDB } from "@/db";
import { parseEnv } from "@/env";

const env = parseEnv(process.env);

const auth = betterAuth({
  database: drizzleAdapter(() => createDB, {
    provider: "sqlite",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "tenant",
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  session: {
    expiresIn: 7 * 24 * 60 * 60,
    cookieName: "rently_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
    emails: {
      fromEmail: env.EMAIL_FROM || "noreply@rently.com",
      fromName: "Rently App",
    },
    trustedOrigins: [
      "http://localhost:8787",
      "https://rently.parmjeetmishra.com",
    ],
  },
  plugins: [openAPI()],
});

export default auth;
