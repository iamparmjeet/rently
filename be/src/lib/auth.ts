import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI, phoneNumber } from "better-auth/plugins";
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
      phone: {
        type: "string",
        required: false
      }
    },
  },
  account: {
    accountLinking: {
      enabled: true,
    },
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    cookieName: "rently_session",
  },

  // In v1.5+ cookie options moved to the advanced block
  advanced: {
    cookiePrefix: "rently",
    // biome-ignore lint/style/noProcessEnv: "Only Here"
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  // Top-level config (not nested under session)
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.LOCAL_APP, env.PROD_APP],
  plugins: [
    openAPI(),
    phoneNumber(),
  ],
});
