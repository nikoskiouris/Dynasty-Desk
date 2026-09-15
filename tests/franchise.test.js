import test from "node:test";
import assert from "node:assert/strict";
import {
  personManagerKey,
  buildTakeoverAliasMap,
  resolveFranchiseManagerKey,
  takeoverForRoster,
} from "../docs/modules/franchise.js";

test("takeover aliases a departed owner onto the current roster 12 manager", () => {
  const { aliases, takeovers } = buildTakeoverAliasMap({
    currentRosters: [
      { roster_id: 12, owner_id: "juan" },
      { roster_id: 1, owner_id: "niko" },
    ],
    historyEntries: [
      { isCurrent: true, leagueId: "2026", rosters: [{ roster_id: 12, owner_id: "juan" }] },
      { isCurrent: false, leagueId: "2025", rosters: [{ roster_id: 12, owner_id: "gus" }] },
    ],
    users: [
      { user_id: "juan", display_name: "Juan Platanis" },
      { user_id: "gus", display_name: "Gus K" },
    ],
  });

  assert.equal(
    resolveFranchiseManagerKey("gus", "2025", 12, aliases),
    personManagerKey("juan")
  );
  assert.equal(
    resolveFranchiseManagerKey("juan", "2026", 12, aliases),
    personManagerKey("juan")
  );
  const note = takeoverForRoster(takeovers, 12);
  assert.equal(note.fromName, "Gus K");
  assert.equal(note.toName, "Juan Platanis");
});

test("swapped owners who both still play keep their own keys", () => {
  const { aliases } = buildTakeoverAliasMap({
    currentRosters: [
      { roster_id: 12, owner_id: "juan" },
      { roster_id: 5, owner_id: "gus" },
    ],
    historyEntries: [
      { isCurrent: false, leagueId: "2025", rosters: [{ roster_id: 12, owner_id: "gus" }, { roster_id: 5, owner_id: "juan" }] },
    ],
  });
  assert.equal(aliases.size, 0);
  assert.equal(resolveFranchiseManagerKey("gus", "2025", 12, aliases), personManagerKey("gus"));
});
