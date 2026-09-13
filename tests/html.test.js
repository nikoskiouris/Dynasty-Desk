import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, formatNumber, formatSignedNumber, clamp, copyTextToClipboard } from "../docs/modules/html.js";

test("escapeHtml encodes markup", () => {
  assert.equal(escapeHtml(`<img src="x" alt='y'>`), "&lt;img src=&quot;x&quot; alt=&#39;y&#39;&gt;");
});

test("number helpers keep signs and locale digits", () => {
  assert.equal(formatSignedNumber(12), `+${formatNumber(12)}`);
  assert.equal(formatSignedNumber(-3), formatNumber(-3));
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-2, 0, 10), 0);
});

test("copyTextToClipboard uses the clipboard API then a textarea fallback", async () => {
  const writes = [];
  const ok = await copyTextToClipboard("hello", { writeText: async (text) => writes.push(text) });
  assert.equal(ok, true);
  assert.deepEqual(writes, ["hello"]);

  const doc = {
    body: {
      child: null,
      appendChild(node) {
        this.child = node;
      },
      removeChild() {
        this.child = null;
      },
    },
    createElement() {
      return {
        value: "",
        style: {},
        setAttribute() {},
        select() {},
      };
    },
    execCommand() {
      return true;
    },
  };
  const fallback = await copyTextToClipboard("paste me", { writeText: null }, doc);
  assert.equal(fallback, true);
});
