import z from "zod";

export const CreditNoteDataSchema = z.object({
	credit: z.object({
		id: z.uuid(),
		creditNoteNo: z.string(),
		type: z.string(),
		amount: z.number(),
		reason: z.string(),
		appliedAs: z.string(),
		createdAt: z.date(),
		reversedAt: z.date().nullable(),
	}),
	utility: z
		.object({
			id: z.uuid(),
			utilityType: z.string(),
			totalAmount: z.number(),
			previousReading: z.number().nullable(),
			currentReading: z.number().nullable(),
			ratePerUnit: z.number().nullable(),
			fixedCharge: z.number().nullable(),
			currentReadingDate: z.date(),
			previousReadingDate: z.date().nullable(),
		})
		.nullable(),
	lease: z.object({
		id: z.uuid(),
		rent: z.number(),
	}),
	property: z.object({
		name: z.string(),
		address: z.string(),
	}),
	unit: z.object({
		unitNumber: z.string(),
	}),
	tenant: z.object({
		name: z.string(),
	}),
	owner: z.object({
		name: z.string(),
		companyName: z.string().nullable(),
		address: z.string().nullable(),
		gstNumber: z.string().nullable(),
		gstEnabled: z.boolean(),
		gstRateRent: z.number().nullable(),
		gstRateMaintenance: z.number().nullable(),
	}),
});

export type CreditNoteData = z.infer<typeof CreditNoteDataSchema>;
