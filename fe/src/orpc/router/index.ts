import { leaseRouter, propertyRouter, unitRouter } from "./rently";

const appRouter = {
  rent: {
    properties: propertyRouter,
    leases: leaseRouter,
    units: unitRouter,
  },
};

export default appRouter;
export type AppRouter = typeof appRouter;
