import { getStore } from "@netlify/blobs";
import { createVisitHandler, wrapLambdaHandler } from "../lib/traffic.js";

export const handler = wrapLambdaHandler(
  createVisitHandler({
    getStore: () => getStore({ name: "desk-traffic", consistency: "strong" }),
  }),
);
