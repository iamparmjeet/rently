import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  account,
  leases,
  payments,
  properties,
  session,
  units,
  user,
  utilities,
} from "./schema";

// Select types (for retrieving data)
export type User = InferSelectModel<typeof user>;
export type Account = InferSelectModel<typeof account>;
export type Session = InferSelectModel<typeof session>;
export type Property = InferSelectModel<typeof properties>;
export type Unit = InferSelectModel<typeof units>;
export type Lease = InferSelectModel<typeof leases>;
export type Utility = InferSelectModel<typeof utilities>;
export type Payment = InferSelectModel<typeof payments>;

// Insert types (for creating new records)
export type NewUser = InferInsertModel<typeof user>;
export type NewAccount = InferInsertModel<typeof account>;
export type NewSession = InferInsertModel<typeof session>;
export type NewProperty = InferInsertModel<typeof properties>;
export type NewUnit = InferInsertModel<typeof units>;
export type NewLease = InferInsertModel<typeof leases>;
export type NewUtility = InferInsertModel<typeof utilities>;
export type NewPayment = InferInsertModel<typeof payments>;
