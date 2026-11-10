import { describe, expect, it } from "vitest";
import { productSelection, productSelectionUrl } from "../../src/features/store-shell/product-selection.js";

const members = [
  { id: "tee-m", availability: { sellable: true } },
  { id: "tee-l", availability: { sellable: true } },
  { id: "tee-xl", availability: { sellable: false } },
];
const selection = (query: string) => productSelection(members, new URLSearchParams(query));

describe("product selection links", () => {
  it("keeps the first sellable default only when no item was requested", () => {
    expect(selection("")).toEqual({ member: members[0], stale: false });
    expect(productSelection([...members].reverse(), new URLSearchParams()).member).toBe(members[1]);
    expect(productSelection([members[2]!], new URLSearchParams()).member).toBe(members[2]);
    expect(productSelection([], new URLSearchParams("item=foreign"))).toEqual({ member: null, stale: false });
  });

  it("resolves an exact current member, even when sold out", () => {
    expect(selection("item=tee-l")).toEqual({ member: members[1], stale: false });
    expect(selection("item=tee-xl")).toEqual({ member: members[2], stale: false });
  });

  it("does not silently choose a sibling for stale, foreign, empty or duplicate requests", () => {
    for (const query of ["item=", "item=removed", "item=mug", "item=L", "item=tee", "item=tee-l&item=tee-m", "item=tee-l&item=tee-l", "item=%3Cscript%3E", "item=__proto__"]) {
      expect(selection(query)).toEqual({ member: null, stale: true });
    }
  });

  it("updates only the selected item while keeping unrelated query and fragment state", () => {
    const url = productSelectionUrl("https://backroadbum.com/products/tee?item=tee-m&item=old&ref=shop#details", "tee-l");
    expect(url).toBe("https://backroadbum.com/products/tee?item=tee-l&ref=shop#details");
    expect(selection(new URL(url).search)).toEqual({ member: members[1], stale: false });
    // An impossible combination must still be unresolved after reload, not defaulted.
    const unresolved = productSelectionUrl(url, null);
    expect(new URL(unresolved).searchParams.getAll("item")).toEqual([""]);
    expect(selection(new URL(unresolved).search).stale).toBe(true);
  });
});
