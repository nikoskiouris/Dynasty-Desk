import { getStore } from "@netlify/blobs";
import { createVisitHandler } from "../lib/traffic.js";

export default createVisitHandler({
  getStore: () => getStore({ name: "desk-traffic", consistency: "strong" }),
});

export const config = {
  path: ["/api/visit", "/api/views"],
};
