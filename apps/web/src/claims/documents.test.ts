import { expect, test } from "vitest";

import { documentType, fileKind } from "./documents";

test("a file's type is what the browser says when the API takes it, else what its name says", () => {
  expect(documentType({ name: "a.pdf", type: "application/pdf" })).toBe("application/pdf");
  // Windows calls a CSV an Excel file; the API takes that.
  expect(documentType({ name: "a.csv", type: "application/vnd.ms-excel" })).toBe(
    "application/vnd.ms-excel",
  );
  expect(documentType({ name: "Letter.EML", type: "" })).toBe("message/rfc822");
  expect(documentType({ name: "IMG_1.heic", type: "" })).toBe("image/heic");
  expect(documentType({ name: "site.html", type: "text/html" })).toBeNull();
  expect(documentType({ name: "archive.zip", type: "" })).toBeNull();
});

test("what kind of file, in a word", () => {
  expect(fileKind("application/pdf")).toBe("PDF");
  expect(fileKind("application/msword")).toBe("Word");
  expect(fileKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(
    "Excel",
  );
  expect(fileKind("message/rfc822")).toBe("Email");
  expect(fileKind("image/png")).toBe("Image");
});
