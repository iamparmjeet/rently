import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/env";

export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
	plugins: [
		inferAdditionalFields({
			user: {
				phone: {
					type: "string",
					required: false,
				},
				role: {
					type: "string",
					defaultValues: "owner",
					required: false,
				},
			},
		}),
	],
});

export const { signIn, signUp, signOut, useSession } = authClient;
