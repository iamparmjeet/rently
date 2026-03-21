import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { USER_ROLE_VALUES } from "@/constants/user-roles";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import env from "@/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
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
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: USER_ROLE_VALUES[1], // Default Owner
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
    },
  },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    cookieName: "rently_session",
    cookieOptions: {
      httpOnly: true,
      // biome-ignore lint/style/noProcessEnv: "Only Here"
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
    emails: {
      fromEmail: env.EMAIL_FROM || "noreply@rently.com",
      fromName: "Rently App",
    },
    trustedOrigins: [env.LOCAL_APP, env.PROD_APP],
  },
  plugins: [openAPI()],
});
