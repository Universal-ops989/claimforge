// Type-level tests: `tsc` (the typecheck task) verifies every assertion; at runtime the
// `expectTypeOf` calls are no-ops. They pin the shapes later hooks rely on, so a contract
// change or a generator upgrade that alters them fails loudly.
import { describe, expectTypeOf, test } from "vitest";

import type {
  CursorPage,
  MethodOf,
  PathParams,
  Problem,
  QueryParams,
  RequestBody,
  ResponseBody,
  Schema,
  SchemaName,
  Schemas,
  SuccessStatus,
} from "./index";

type Claims = "/v1/organizations/{organization_id}/claims";
type Claim = "/v1/organizations/{organization_id}/claims/{claim_id}";
type PhotoComplete =
  "/v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads/{upload_id}/complete";
type Reports = "/v1/organizations/{organization_id}/claims/{claim_id}/reports";
type Contact = "/v1/organizations/{organization_id}/contacts/{contact_id}";

describe("schemas", () => {
  test("named schemas resolve to their generated shape", () => {
    expectTypeOf<Schema<"ClaimRead">["number"]>().toEqualTypeOf<string>();
    expectTypeOf<Schema<"ClaimRead">["status"]>().toEqualTypeOf<Schema<"ClaimStatus">>();
    expectTypeOf<Schema<"ClaimRead">["loss_date"]>().toEqualTypeOf<string | null>();
  });

  test("enums are string unions", () => {
    expectTypeOf<"new">().toExtend<Schema<"ClaimStatus">>();
    expectTypeOf<"closed">().toExtend<Schema<"ClaimStatus">>();
    expectTypeOf<"made_up">().not.toExtend<Schema<"ClaimStatus">>();
  });

  test("request fields with defaults stay optional; required ones don't", () => {
    expectTypeOf<Schema<"ClaimCreate">>().toHaveProperty("loss_type");
    expectTypeOf<{ loss_type: "water" }>().toExtend<Schema<"ClaimCreate">>();
  });

  test("problem details carry the stable error code", () => {
    expectTypeOf<Problem["code"]>().toEqualTypeOf<string>();
    expectTypeOf<Problem["status"]>().toEqualTypeOf<number>();
    expectTypeOf<NonNullable<Problem["errors"]>[number]>().toEqualTypeOf<Schema<"FieldError">>();
  });

  test("every CursorPage_* schema is a CursorPage of its items", () => {
    type PageName = Extract<SchemaName, `CursorPage_${string}`>;
    type Generic<Name extends PageName> = CursorPage<Schemas[Name]["items"][number]>;
    type Mismatched = {
      [Name in PageName]: [Schemas[Name]] extends [Generic<Name>]
        ? [Generic<Name>] extends [Schemas[Name]]
          ? never
          : Name
        : Name;
    }[PageName];

    expectTypeOf<Mismatched>().toBeNever();
    expectTypeOf<Schema<"CursorPage_ClaimSummary_">>().toEqualTypeOf<
      CursorPage<Schema<"ClaimSummary">>
    >();
  });
});

describe("operations", () => {
  test("MethodOf lists only the methods a path supports", () => {
    expectTypeOf<MethodOf<Claims>>().toEqualTypeOf<"get" | "post">();
    expectTypeOf<MethodOf<Claim>>().toEqualTypeOf<"get" | "patch">();
    expectTypeOf<MethodOf<Contact>>().toEqualTypeOf<"get" | "patch" | "delete">();
  });

  test("path and query parameters", () => {
    expectTypeOf<PathParams<Claims, "get">>().toEqualTypeOf<{ organization_id: string }>();
    expectTypeOf<QueryParams<Claims, "get">["status"]>().toEqualTypeOf<
      Schema<"ClaimStatus">[] | undefined
    >();
    expectTypeOf<QueryParams<Claims, "get">>().toHaveProperty("cursor");
    expectTypeOf<QueryParams<Claims, "post">>().toBeNever();
  });

  test("request bodies", () => {
    expectTypeOf<RequestBody<Claims, "post">>().toEqualTypeOf<Schema<"ClaimCreate">>();
    expectTypeOf<RequestBody<Claim, "patch">>().toEqualTypeOf<Schema<"ClaimUpdate">>();
    expectTypeOf<RequestBody<Claims, "get">>().toBeNever();
  });

  test("response bodies default to the success status", () => {
    expectTypeOf<SuccessStatus<Claims, "post">>().toEqualTypeOf<201>();
    expectTypeOf<ResponseBody<Claims, "get">>().toEqualTypeOf<CursorPage<Schema<"ClaimSummary">>>();
    expectTypeOf<ResponseBody<Claims, "post">>().toEqualTypeOf<Schema<"ClaimRead">>();
    expectTypeOf<ResponseBody<Reports, "post">>().toEqualTypeOf<Schema<"ReportJobRead">>();
    // Completing an upload twice answers 200 the second time, with the same body.
    expectTypeOf<SuccessStatus<PhotoComplete, "post">>().toEqualTypeOf<200 | 201>();
    expectTypeOf<ResponseBody<PhotoComplete, "post">>().toEqualTypeOf<Schema<"PhotoRead">>();
  });

  test("204 responses have no body", () => {
    expectTypeOf<SuccessStatus<Contact, "delete">>().toEqualTypeOf<204>();
    expectTypeOf<ResponseBody<Contact, "delete">>().toBeUndefined();
  });

  test("error responses can be picked by status", () => {
    expectTypeOf<ResponseBody<Claims, "post", 422>>().toEqualTypeOf<Problem>();
  });
});
