import { expect, test } from "vitest";

import { addressLines } from "./address";

test("writes the street, then the city, region and postal code", () => {
  expect(
    addressLines({
      line1: "100 Congress Ave",
      line2: "Suite 4",
      city: "Austin",
      region: "TX",
      postal_code: "78701",
    }),
  ).toBe("100 Congress Ave, Suite 4\nAustin, TX 78701");
});

test("leaves out what isn't there, without stray commas", () => {
  expect(
    addressLines({
      line1: "5 Elm St",
      line2: null,
      city: "Leeds",
      region: null,
      postal_code: "LS1",
    }),
  ).toBe("5 Elm St\nLeeds, LS1");
  expect(
    addressLines({ line1: "5 Elm St", line2: "", city: "Leeds", region: "", postal_code: "" }),
  ).toBe("5 Elm St\nLeeds");
  expect(addressLines({ line1: "", city: "" })).toBe("");
});
