import {
	clearRegisteredSampleWorkspace,
	getWorkspaceExperience,
	loadRegisteredSampleWorkspace,
} from "@rently/api/modules/sample-workspace";
import { ownerProcedure, protectedProcedure } from "@rently/api/procedures";
import z from "zod";

const experienceOutput = z.object({
	mode: z.enum(["live", "registered_sample", "public_demo"]),
	persona: z.enum(["owner", "tenant"]).nullable(),
	canLoadSample: z.boolean(),
	samplePreviouslyUsed: z.boolean(),
	nextPublicResetAt: z.date().nullable(),
	capabilities: z.object({
		outboundCommunication: z.boolean(),
		privateDocuments: z.boolean(),
		accountManagement: z.boolean(),
		billingManagement: z.boolean(),
	}),
});

export const getExperience = protectedProcedure
	.route({ method: "GET", path: "/workspace/experience" })
	.output(experienceOutput)
	.handler(({ context }) =>
		getWorkspaceExperience({ database: context.db, user: context.user }),
	);

export const loadSample = ownerProcedure
	.route({ method: "POST", path: "/workspace/load-sample" })
	.output(experienceOutput)
	.handler(({ context }) =>
		loadRegisteredSampleWorkspace({
			database: context.db,
			owner: context.user,
		}),
	);

export const clearSample = ownerProcedure
	.route({ method: "POST", path: "/workspace/clear-sample" })
	.input(z.object({ confirmation: z.literal("START") }))
	.output(experienceOutput)
	.handler(({ context }) =>
		clearRegisteredSampleWorkspace({
			database: context.db,
			owner: context.user,
		}),
	);
