import { getStore } from "@netlify/blobs";
import { createVisitHandler } from "../lib/traffic.js";

const visitHandler = createVisitHandler({
  getStore: () => getStore("desk-traffic"),
});

export default visitHandler;
