import { test } from "node:test";
import assert from "node:assert/strict";
import { isAslWord, visionTip } from "../src/lib/signRouter.ts";

test("a held hand stays an Arabic letter, a moving sign becomes an ASL word", () => {
  assert.equal(isAslWord(95, 0.1, 0), false); // ثابتة: حرف عربي حتى لو الموديل الإنجليزي واثق
  assert.equal(isAslWord(80, 0.6, 0), true);
  assert.equal(isAslWord(60, 0.6, 0), false);
  // انكتب حرف عربي: نحتاج ثقة وحركة أعلى
  assert.equal(isAslWord(80, 0.6, 2), false);
  assert.equal(isAslWord(95, 0.6, 2), true);
});

const box = (x0: number, y0: number, size: number) =>
  Array.from({ length: 21 }, (_, i) => ({
    x: x0 + (size * (i % 5)) / 4,
    y: y0 + (size * (i % 3)) / 2,
  }));

test("vision tips", () => {
  assert.equal(visionTip({ dark: true, msWithoutHand: 0, hand: box(0.4, 0.4, 0.2) }), "light");
  assert.equal(visionTip({ dark: false, msWithoutHand: 0, hand: box(0.45, 0.45, 0.05) }), "closer");
  assert.equal(visionTip({ dark: false, msWithoutHand: 0, hand: box(0.9, 0.4, 0.2) }), "center");
  assert.equal(visionTip({ dark: false, msWithoutHand: 6000 }), "showHand");
  assert.equal(visionTip({ dark: false, msWithoutHand: 1000 }), null);
  assert.equal(visionTip({ dark: false, msWithoutHand: 0, hand: box(0.4, 0.4, 0.2) }), null);
});
