export function buildRecapCardModel({
  leagueName,
  weekLabel,
  provisional = false,
  games = [],
  awards = [],
  favorite = null,
  url = "",
} = {}) {
  const rows = (games || [])
    .slice()
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    .slice(0, 4)
    .map((game) => {
      const sides = [...(game.sides || [])].sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
      const left = sides[0] || { name: "TBD", points: 0 };
      const right = sides[1] || { name: "TBD", points: 0 };
      return {
        leftName: String(left.name || "TBD"),
        leftPoints: Number(left.points || 0),
        rightName: String(right.name || "TBD"),
        rightPoints: Number(right.points || 0),
        live: Boolean(provisional),
      };
    });

  const award = (awards || []).find((item) => item?.id === "mvp") || awards?.[0] || null;
  return {
    eyebrow: "Dynasty Desk",
    title: String(leagueName || "League").trim() || "League",
    kicker: `${String(weekLabel || "Week").toUpperCase()} · ${provisional ? "LIVE" : "FINAL"}`,
    games: rows,
    award: award
      ? {
          title: String(award.title || "Honor"),
          teamName: String(award.teamName || ""),
          valueLabel: String(award.valueLabel || ""),
        }
      : null,
    favorite: favorite
      ? {
          name: String(favorite.name || "TBD"),
          detail: String(favorite.detail || ""),
        }
      : null,
    url: String(url || ""),
    empty: rows.length === 0,
  };
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export function drawRecapCard(ctx, model, { width = 1080, height = 1350 } = {}) {
  const palette = {
    bg: "#070a12",
    panel: "rgba(255,255,255,0.06)",
    line: "rgba(255,255,255,0.12)",
    text: "#eef2fa",
    muted: "#8f9bb3",
    blue: "#38bdf8",
    violet: "#a78bfa",
    green: "#34d399",
    amber: "#fbbf24",
  };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.8, 0, 40, width * 0.8, 0, width * 0.7);
  glow.addColorStop(0, "rgba(56,189,248,0.28)");
  glow.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.1, height, 20, width * 0.1, height, width * 0.6);
  glow2.addColorStop(0, "rgba(167,139,250,0.22)");
  glow2.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = palette.blue;
  ctx.font = "700 28px Inter, Sora, system-ui, sans-serif";
  ctx.fillText(model.eyebrow || "Dynasty Desk", 72, 92);

  ctx.fillStyle = palette.text;
  ctx.font = "800 64px Sora, Inter, system-ui, sans-serif";
  const titleLines = wrapText(ctx, model.title, width - 144);
  titleLines.slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, 72, 170 + index * 72);
  });

  ctx.fillStyle = palette.amber;
  ctx.font = "700 30px Inter, system-ui, sans-serif";
  ctx.fillText(model.kicker, 72, 170 + titleLines.slice(0, 2).length * 72 + 24);

  let y = 360;
  ctx.fillStyle = palette.muted;
  ctx.font = "700 22px Inter, system-ui, sans-serif";
  ctx.fillText("SCOREBOARD", 72, y);
  y += 28;

  if (model.empty) {
    roundRect(ctx, 72, y, width - 144, 140, 24);
    ctx.fillStyle = palette.panel;
    ctx.fill();
    ctx.fillStyle = palette.muted;
    ctx.font = "600 28px Inter, system-ui, sans-serif";
    ctx.fillText("No scores posted yet.", 100, y + 82);
    y += 170;
  } else {
    model.games.forEach((game) => {
      roundRect(ctx, 72, y, width - 144, 128, 24);
      ctx.fillStyle = palette.panel;
      ctx.fill();
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = palette.text;
      ctx.font = "700 32px Inter, system-ui, sans-serif";
      ctx.fillText(game.leftName, 100, y + 52);
      ctx.fillText(game.rightName, 100, y + 100);
      ctx.fillStyle = palette.blue;
      ctx.font = "800 36px Sora, Inter, system-ui, sans-serif";
      const leftPts = game.leftPoints.toFixed(1);
      const rightPts = game.rightPoints.toFixed(1);
      ctx.fillText(leftPts, width - 100 - ctx.measureText(leftPts).width, y + 52);
      ctx.fillStyle = palette.violet;
      ctx.fillText(rightPts, width - 100 - ctx.measureText(rightPts).width, y + 100);
      y += 144;
    });
  }

  if (model.award) {
    y += 12;
    roundRect(ctx, 72, y, width - 144, 150, 24);
    ctx.fillStyle = "rgba(52,211,153,0.14)";
    ctx.fill();
    ctx.fillStyle = palette.green;
    ctx.font = "700 22px Inter, system-ui, sans-serif";
    ctx.fillText(model.award.title.toUpperCase(), 100, y + 48);
    ctx.fillStyle = palette.text;
    ctx.font = "800 36px Sora, Inter, system-ui, sans-serif";
    ctx.fillText(model.award.teamName, 100, y + 98);
    ctx.fillStyle = palette.muted;
    ctx.font = "600 24px Inter, system-ui, sans-serif";
    ctx.fillText(model.award.valueLabel, 100, y + 130);
    y += 174;
  }

  if (model.favorite) {
    roundRect(ctx, 72, y, width - 144, 130, 24);
    ctx.fillStyle = "rgba(167,139,250,0.16)";
    ctx.fill();
    ctx.fillStyle = palette.violet;
    ctx.font = "700 22px Inter, system-ui, sans-serif";
    ctx.fillText("TITLE FAVORITE", 100, y + 46);
    ctx.fillStyle = palette.text;
    ctx.font = "800 36px Sora, Inter, system-ui, sans-serif";
    ctx.fillText(model.favorite.name, 100, y + 94);
    if (model.favorite.detail) {
      ctx.fillStyle = palette.muted;
      ctx.font = "600 22px Inter, system-ui, sans-serif";
      ctx.fillText(model.favorite.detail, 100, y + 122);
    }
    y += 154;
  }

  ctx.fillStyle = palette.muted;
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  const footer = model.url || "Free GitHub Pages link · tap to open the desk";
  wrapText(ctx, footer, width - 144).slice(0, 3).forEach((line, index) => {
    ctx.fillText(line, 72, height - 90 + index * 28);
  });
}

export async function renderRecapCardBlob(model, {
  width = 1080,
  height = 1350,
  documentRef = globalThis.document,
} = {}) {
  if (!documentRef?.createElement) {
    throw new Error("Canvas is not available in this environment.");
  }
  const canvas = documentRef.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not open a 2D canvas for the recap card.");
  drawRecapCard(ctx, model, { width, height });
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) return blob;
  }
  const dataUrl = canvas.toDataURL("image/png");
  const binary = atob(dataUrl.split(",")[1] || "");
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

export function recapCardFilename(model) {
  const slug = String(model?.title || "league")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const week = String(model?.kicker || "week")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${slug || "league"}-${week || "week"}-recap.png`;
}
