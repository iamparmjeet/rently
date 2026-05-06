import { env } from "@rently/env/web";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_SERVER_URL,
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
