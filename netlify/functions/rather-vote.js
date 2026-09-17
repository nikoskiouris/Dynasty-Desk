import { getStore } from "@netlify/blobs";
import { createRatherVoteHandler } from "../lib/rather-crowd.js";

const ratherVoteHandler = createRatherVoteHandler({
  getStore: () => getStore("desk-rather"),
});

export default ratherVoteHandler;
