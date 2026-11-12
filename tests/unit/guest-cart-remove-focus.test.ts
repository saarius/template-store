import { expect, it } from "vitest";
import { cartRemovalFocusId } from "../../src/features/guest-cart/remove-focus.js";

it.each([
  { before: ["mug", "cap", "bandana"], removed: "mug", after: ["cap", "bandana"], focused: "cap" },
  { before: ["mug", "cap", "bandana"], removed: "cap", after: ["mug", "bandana"], focused: "bandana" },
  { before: ["mug", "cap", "bandana"], removed: "bandana", after: ["mug", "cap"], focused: "cap" },
  { before: ["mug"], removed: "mug", after: [], focused: null },
  // Another tab can change storage between rendering the row and removing it.
  { before: ["mug", "cap", "tee-m", "tee-l"], removed: "cap", after: ["mug", "tee-l"], focused: "tee-l" },
  { before: ["mug", "cap", "tee-m", "tee-l"], removed: "tee-m", after: ["mug"], focused: "mug" },
  { before: ["mug", "cap"], removed: "cap", after: ["new"], focused: "new" },
  { before: ["mug"], removed: "unknown", after: ["new", "mug"], focused: "new" },
  { before: ["mug"], removed: "mug", after: ["mug"], focused: null },
])("returns $focused after removing $removed from $before", ({ before, removed, after, focused }) => {
  const originalBefore = [...before];
  const originalAfter = [...after];
  expect(cartRemovalFocusId(before, removed, after)).toBe(focused);
  expect(before).toEqual(originalBefore);
  expect(after).toEqual(originalAfter);
});
