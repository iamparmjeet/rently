import z from "zod";
import {
  INVITE_STATUS_VALUES,
  LEASE_STATUS_VALUES,
  PAYMENT_TYPE_VALUES,
  PROPERTY_TYPES_VALUES,
  UNIT_STATUS_VALUES,
  UNIT_TYPES_VALUES,
  UTILITY_TYPE_VALUES,
} from "@/constants/rent-constants";

// ******** Property **********

export const PropertySchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  name: z.string().min(1, "Name is required"),
  address: z.string().min(5, "Address must be at least 5 characters long"),
  type: z.enum(PROPERTY_TYPES_VALUES),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePropertySchema = PropertySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdatePropertySchema = PropertySchema.partial().pick({
  name: true,
  address: true,
  type: true,
});

// ********* Property ends ************

export const UnitSchema = z.object({
  id: z.uuid(),
  propertyId: z.uuid(),
  unitNumber: z.string().min(1, "Unit number must be at least 1"),
  type: z.enum(UNIT_TYPES_VALUES),
  area: z.number().min(1, "Area must be at least 1"),
  baseRent: z.number().min(500, "Base Rent must be at least 500"),
  description: z.string().nullable(),
  status: z.enum(UNIT_STATUS_VALUES),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateUnitSchmea = UnitSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateUnitSchema = UnitSchema.partial().pick({
  unitNumber: true,
  type: true,
  area: true,
  baseRent: true,
  description: true,
  status: true,
});

const LeaseBaseSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    unitId: z.string().min(1, "Unit ID must be at least 1"),
    startDate: z.date(),
    endDate: z.date().optional(),
    rent: z.number().positive("Rent must be a positive number"),
    deposit: z.number().optional(),
    status: z.enum(LEASE_STATUS_VALUES),
    referenceId: z.uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })

const endDateAfterStartDate = (lease: z.infer<typeof LeaseBaseSchema>, ctx: any) => {
  if (lease.endDate && lease.startDate && lease.endDate <= lease.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "End date must be after start date",
      path: ["endDate"],
    });
  }
};

export const LeaseSchema = LeaseBaseSchema.superRefine(endDateAfterStartDate)

export const CreateLeaseSchema = LeaseBaseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateLeaseSchema = LeaseBaseSchema.partial().pick({
  unitId: true,
  tenantId: true,
  startDate: true,
  endDate: true,
  rent: true,
  deposit: true,
  status: true,
  referenceId: true,
});

export const UtilitySchema = z.object({
  id: z.uuid(),
  leaseId: z.uuid(),
  utilityType: z.enum(UTILITY_TYPE_VALUES),
  readingDate: z.date(),
  ratePerUnit: z.number().min(1, "Rate per unit must be at least 1").default(9),
  unitsUsed: z.number().min(0, "Units used must be at least 0").default(0),
  previousReading: z
    .number()
    .min(0, "Previous reading must be at least 0")
    .default(0),
  currentReading: z.number().default(0),
  fixedCharge: z.number().optional().default(0),
  totalAmount: z.number().optional(),
  isPaid: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateUtilitySchema = UtilitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateUtilitySchema = UtilitySchema.partial().pick({
  leaseId: true,
  utilityType: true,
  readingDate: true,
  ratePerUnit: true,
  unitsUsed: true,
  previousReading: true,
  currentReading: true,
  fixedCharge: true,
  totalAmount: true,
  isPaid: true,
});

export const PaymentSchema = z.object({
  id: z.uuid(),
  leaseId: z.uuid(),
  amount: z.number().positive(),
  paymentDate: z.date(),
  type: z.enum(PAYMENT_TYPE_VALUES),
  description: z.string().optional().nullable(),
  utilityId: z.uuid().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePaymentSchema = PaymentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdatePaymentSchema = PaymentSchema.partial().pick({
  leaseId: true,
  amount: true,
  paymentDate: true,
  type: true,
  description: true,
  utilityId: true,
});

export const ReferrerSchema = z.object({
  id: z.uuid(),
  referredUserId: z.uuid(),
  note: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateReferrerSchema = ReferrerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateReferrerSchema = ReferrerSchema.partial().pick({
  referredUserId: true,
  note: true,
});

export const TenantInviteSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  token: z.uuid(),
  invitedById: z.uuid(),
  expiresAt: z.date(),
  status: z.enum(INVITE_STATUS_VALUES).default("pending"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateInviteSchema = TenantInviteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateInviteSchema = TenantInviteSchema.partial().pick({
  email: true,
  token: true,
  invitedById: true,
  expiresAt: true,
  status: true,
});

export const AcceptInviteSchema = z.object({
  token: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
});
