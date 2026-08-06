import z from "zod";

export const PaymentReceiptDataSchema = z.object({
	receiptNumber: z.string(),
	payment: z.object({
		id: z.uuid(),
		amount: z.number(),
		paymentDate: z.date(),
		type: z.string(),
		paymentMethods: z.string().nullable(),
		referenceNumber: z.string().nullable(),
		description: z.string().nullable(),
	}),
	lease: z.object({
		id: z.uuid(),
		rent: z.number(),
		startDate: z.date(),
		endDate: z.date().nullable(),
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
		address: z.string().nullable(),
	}),
	owner: z.object({
		name: z.string(),
		companyName: z.string().nullable(),
		address: z.string().nullable(),
		gstNumber: z.string().nullable(),
	}),
});

export type PaymentReceiptData = z.infer<typeof PaymentReceiptDataSchema>;
