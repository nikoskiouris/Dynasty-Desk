import test from "node:test";
import assert from "node:assert/strict";
import {
  personManagerKey,
  buildFranchiseIndex,
  buildTakeoverAliasMap,
  resolveRosterIdentity,
  resolveFranchiseManagerKey,
  takeoverForRoster,
  isPlaceholderRosterName,
  ownerIdFromRoster,
} from "../docs/modules/franchise.js";

const GUS = "1003867370957426688";
const JUAN = "1137181038813515776";
const NIKO = "niko";

function tryHardFixture() {
  return {
    currentLeagueId: "2026-league",
    currentRosters: [
      { roster_id: 12, owner_id: JUAN },
      { roster_id: 1, owner_id: NIKO },
    ],
    historyEntries: [
      {
        isCurrent: true,
        leagueId: "2026-league",
        season: "2026",
        users: [{ user_id: JUAN, display_name: "JuanPlantis" }],
        rosters: [{ roster_id: 12, owner_id: JUAN }],
      },
      {
        isCurrent: false,
        leagueId: "2025-league",
        season: "2025",
        users: [{ user_id: NIKO, display_name: "NikoSkiouris" }],
        rosters: [{ roster_id: 12, owner_id: null, co_owners: null }],
      },
      {
        isCurrent: false,
        leagueId: "2024-league",
        season: "2024",
        users: [{ user_id: GUS, display_name: "gusk" }],
        rosters: [{ roster_id: 12, owner_id: GUS }],
      },
    ],
    users: [
      { user_id: JUAN, display_name: "JuanPlantis" },
      { user_id: GUS, display_name: "gusk" },
      { user_id: NIKO, display_name: "NikoSkiouris" },
    ],
  };
}

test("ownerIdFromRoster treats null and unknown as vacant", () => {
  assert.equal(ownerIdFromRoster({ owner_id: null }), "");
  assert.equal(ownerIdFromRoster({ owner_id: "unknown" }), "");
  assert.equal(ownerIdFromRoster({ owner_id: "", co_owners: [GUS] }), GUS);
});

test("vacant 2025 roster 12 recovers Gus, not a Team 12 identity", () => {
  const index = buildFranchiseIndex(tryHardFixture());
  const vacant = resolveRosterIdentity(index, { userId: "", leagueId: "2025-league", rosterId: 12 });
  const gusYear = resolveRosterIdentity(index, { userId: GUS, leagueId: "2024-league", rosterId: 12 });
  const juanYear = resolveRosterIdentity(index, { userId: JUAN, leagueId: "2026-league", rosterId: 12 });

  assert.equal(vacant.userId, GUS);
  assert.equal(vacant.inferred, true);
  assert.equal(vacant.managerKey, personManagerKey(GUS));
  assert.equal(vacant.managerName, "gusk");
  assert.equal(isPlaceholderRosterName(vacant.managerName), false);

  assert.equal(gusYear.managerKey, personManagerKey(GUS));
  assert.equal(juanYear.managerKey, personManagerKey(JUAN));
  assert.equal(juanYear.managerName, "JuanPlantis");

  const rosterKeys = [...index.identities.values()].filter((row) => String(row.managerKey).startsWith("roster:"));
  assert.equal(rosterKeys.length, 0);
  assert.notEqual(gusYear.managerKey, juanYear.managerKey);
});

test("takeover notes the desk change without merging people onto Juan", () => {
  const index = buildFranchiseIndex(tryHardFixture());
  const { aliases, takeovers } = buildTakeoverAliasMap(tryHardFixture());
  const note = takeoverForRoster(index.takeovers, 12);

  assert.equal(aliases.size, 0);
  assert.equal(note.fromName, "gusk");
  assert.equal(note.toName, "JuanPlantis");
  assert.equal(takeoverForRoster(takeovers, 12).fromUserId, GUS);
  assert.equal(
    resolveFranchiseManagerKey(GUS, "2024-league", 12, aliases, index),
    personManagerKey(GUS)
  );
  assert.equal(
    resolveFranchiseManagerKey("", "2025-league", 12, aliases, index),
    personManagerKey(GUS)
  );
});

test("known user with no users payload is still not named Roster 12", () => {
  const identity = resolveRosterIdentity(buildFranchiseIndex({ users: [] }), {
    userId: GUS,
    leagueId: "2025-league",
    rosterId: 12,
  });
  assert.equal(identity.managerKey, personManagerKey(GUS));
  assert.equal(identity.managerName, GUS);
  assert.equal(isPlaceholderRosterName(identity.managerName), false);
});

test("swapped owners who both still play keep their own keys", () => {
  const index = buildFranchiseIndex({
    currentRosters: [
      { roster_id: 12, owner_id: "juan" },
      { roster_id: 5, owner_id: "gus" },
    ],
    historyEntries: [
      {
        isCurrent: false,
        leagueId: "2025",
        season: "2025",
        rosters: [
          { roster_id: 12, owner_id: "gus" },
          { roster_id: 5, owner_id: "juan" },
        ],
      },
    ],
  });
  assert.equal(index.takeovers.length, 0);
  assert.equal(
    resolveRosterIdentity(index, { userId: "gus", leagueId: "2025", rosterId: 12 }).managerKey,
    personManagerKey("gus")
  );
  assert.equal(
    resolveRosterIdentity(index, { userId: "", leagueId: "2025", rosterId: 12 }).managerKey,
    personManagerKey("gus")
  );
});

test("vacant slot after a swap goes to the incoming owner, not the manager who still plays", () => {
  const index = buildFranchiseIndex({
    currentLeagueId: "2026",
    currentRosters: [
      { roster_id: 12, owner_id: "juan" },
      { roster_id: 5, owner_id: "gus" },
    ],
    historyEntries: [
      {
        isCurrent: true,
        leagueId: "2026",
        season: "2026",
        rosters: [{ roster_id: 12, owner_id: "juan" }, { roster_id: 5, owner_id: "gus" }],
      },
      {
        isCurrent: false,
        leagueId: "2025",
        season: "2025",
        rosters: [{ roster_id: 12, owner_id: null }, { roster_id: 5, owner_id: "gus" }],
      },
      {
        isCurrent: false,
        leagueId: "2024",
        season: "2024",
        rosters: [{ roster_id: 12, owner_id: "gus" }, { roster_id: 5, owner_id: "juan" }],
      },
    ],
    users: [
      { user_id: "juan", display_name: "Juan Platanis" },
      { user_id: "gus", display_name: "Gus K" },
    ],
  });
  const vacant = resolveRosterIdentity(index, { userId: "", leagueId: "2025", rosterId: 12 });
  assert.equal(vacant.userId, "juan");
  assert.equal(vacant.managerName, "Juan Platanis");
});
