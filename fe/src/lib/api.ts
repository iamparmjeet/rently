import type { RentlyAPI } from "@rently/be/app";
import { hc } from "hono/client";
import { env } from "@/env";

// type Client<T> = ReturnType<typeof hc<T>>;

const API_BASE = env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export const api = hc<RentlyAPI>(API_BASE);

console.log("api", api);

export const AuthAPI = api.api.auth;
export const RentAPI = api.api.v1.rent;
export const SubscriptionAPI = api.api.v1.subscriptions;
