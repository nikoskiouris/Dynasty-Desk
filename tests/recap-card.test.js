import test from "node:test";
import assert from "node:assert/strict";
import { buildRecapCardModel, recapCardFilename, drawRecapCard, recapCardPalette } from "../docs/modules/recap-card.js";

test("recap card model keeps the headline games, MVP, and title favorite", () => {
  const model = buildRecapCardModel({
    leagueName: "Try Hard or Die Hard",
    weekLabel: "Week 1",
    provisional: true,
    games: [
      { total: 200, sides: [{ name: "Niko", points: 120 }, { name: "Demetri", points: 80 }] },
      { total: 150, sides: [{ name: "A", points: 90 }, { name: "B", points: 60 }] },
    ],
    awards: [
      { id: "mvp", title: "Player of the Week (so far)", teamName: "Niko", valueLabel: "38.4" },
    ],
    favorite: { name: "Niko", detail: "41% title" },
    url: "https://dynastyticker.com/?league=1&week=1",
  });
  assert.equal(model.kicker, "WEEK 1 · LIVE");
  assert.equal(model.games[0].leftName, "Niko");
  assert.equal(model.award.teamName, "Niko");
  assert.equal(model.favorite.name, "Niko");
  assert.match(recapCardFilename(model), /try-hard.*week-1.*recap\.png/);
});

test("empty weeks still render a card shell", () => {
  const model = buildRecapCardModel({ leagueName: "League", weekLabel: "Week 1", games: [] });
  assert.equal(model.empty, true);
  assert.equal(model.games.length, 0);
});

test("drawRecapCard paints title, scores, and the free share URL", () => {
  const texts = [];
  const ctx = {
    fillStyle: "",
    font: "",
    strokeStyle: "",
    lineWidth: 0,
    clearRect() {},
    fillRect() {},
    fillText(text) {
      texts.push(String(text));
    },
    measureText(text) {
      return { width: String(text).length * 12 };
    },
    beginPath() {},
    moveTo() {},
    arcTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
  };
  const model = buildRecapCardModel({
    leagueName: "Try Hard or Die Hard",
    weekLabel: "Week 2",
    games: [{ total: 200, sides: [{ name: "Niko", points: 120.4 }, { name: "Demetri", points: 80 }] }],
    awards: [{ id: "mvp", title: "Player of the Week", teamName: "Niko", valueLabel: "38.4" }],
    favorite: { name: "Niko", detail: "41% title" },
    url: "https://example.com/?league=1&week=2",
  });
  drawRecapCard(ctx, model);
  const painted = texts.join(" | ");
  assert.match(painted, /Try Hard or Die Hard/);
  assert.match(painted, /Niko/);
  assert.match(painted, /120\.4/);
  assert.match(painted, /week=2/);
});

test("recap cards follow the desk theme and default to light", () => {
  assert.equal(recapCardPalette("light").bg, "#eef3f2");
  assert.equal(recapCardPalette("dark").bg, "#071018");
  assert.equal(recapCardPalette("light").text, "#102024");
  const fills = [];
  const ctx = {
    fillStyle: "",
    font: "",
    strokeStyle: "",
    lineWidth: 0,
    clearRect() {},
    fillRect() {},
    fillText() {},
    measureText(text) {
      return { width: String(text).length * 12 };
    },
    beginPath() {},
    moveTo() {},
    arcTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
  };
  Object.defineProperty(ctx, "fillStyle", {
    set(value) {
      fills.push(value);
    },
    get() {
      return fills[fills.length - 1];
    },
  });
  const model = buildRecapCardModel({ leagueName: "League", weekLabel: "Week 1", games: [] });
  drawRecapCard(ctx, model);
  assert.equal(fills[0], "#eef3f2");
  fills.length = 0;
  drawRecapCard(ctx, model, { theme: "dark" });
  assert.equal(fills[0], "#071018");
});
