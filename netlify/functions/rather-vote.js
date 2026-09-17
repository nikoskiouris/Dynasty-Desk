import { getStore } from "@netlify/blobs";
import { createRatherVoteHandler, wrapLambdaHandler } from "../lib/rather-crowd.js";

export const handler = wrapLambdaHandler(
  createRatherVoteHandler({
    getStore: () => getStore({ name: "desk-rather", consistency: "strong" }),
  }),
);
