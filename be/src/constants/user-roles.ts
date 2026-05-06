export const USER_ROLES = {
  TENANT: "tenant",
  OWNER: "owner",
  ADMIN: "admin",
} as const;

export const USER_ROLE_VALUES = [
  USER_ROLES.TENANT,
  USER_ROLES.OWNER,
  USER_ROLES.ADMIN,
] as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
