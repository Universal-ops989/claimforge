import { expect, test } from "vitest";

import { displayPhone, telLink } from "./phone";

test("North American numbers read the usual way, extensions included", () => {
  expect(displayPhone("+15125550142")).toBe("(512) 555-0142");
  expect(displayPhone("+15125550142;ext=204")).toBe("(512) 555-0142 ext. 204");
});

test("other numbers show as kept", () => {
  expect(displayPhone("+442079460958")).toBe("+442079460958");
});

test("a call link dials the extension after a pause", () => {
  expect(telLink("+15125550142")).toBe("tel:+15125550142");
  expect(telLink("+15125550142;ext=204")).toBe("tel:+15125550142,204");
});
