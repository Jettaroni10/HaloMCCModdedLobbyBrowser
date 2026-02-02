import assert from "node:assert/strict";
import test from "node:test";
import { rankToIconSrc } from "../lib/ranks";

test("rankToIconSrc pads and clamps ranks", () => {
  assert.equal(rankToIconSrc(1), "/ranks/sr001.svg");
  assert.equal(rankToIconSrc(9), "/ranks/sr009.svg");
  assert.equal(rankToIconSrc(100), "/ranks/sr100.svg");
  assert.equal(rankToIconSrc(0), "/ranks/sr001.svg");
  assert.equal(rankToIconSrc(999), "/ranks/sr100.svg");
});
