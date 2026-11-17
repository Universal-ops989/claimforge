import { readFile } from "node:fs/promises";

import { describe, expect, expectTypeOf, test } from "vitest";
import type { z } from "zod";

import { renderZodSource, ZOD_PATH } from "../scripts/generate.mjs";
import { renderZod } from "../scripts/zod.mjs";
import type {
  ApiPath,
  MethodOf,
  paths,
  RequestBody,
  ResponseBody,
  Schema,
  SchemaName,
} from "./index";
import { responses, schemas, successStatuses, workflows, type requests } from "./zod.gen";

/** `A` and `B` accept exactly the same values (readonly markers aside). */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Responses<P extends ApiPath, M extends MethodOf<P>> = NonNullable<paths[P][M]>["responses"];

describe("zod.gen.ts", () => {
  test("matches the committed OpenAPI contract", { timeout: 30_000 }, async () => {
    const committed = await readFile(ZOD_PATH, "utf8");
    // Stale means openapi.json changed without regenerating: run `just api-openapi`.
    expect(committed === (await renderZodSource()), "zod.gen.ts is stale").toBe(true);
  });

  test("every schema infers exactly the generated TypeScript type", () => {
    type Mismatched = {
      [Name in SchemaName]: Same<z.infer<(typeof schemas)[Name]>, Schema<Name>> extends true
        ? never
        : Name;
    }[SchemaName];
    expectTypeOf<Mismatched>().toBeNever();
  });

  test("every success body infers exactly its ResponseBody", () => {
    type Generated = typeof responses;
    type Mismatched = {
      [Key in keyof Generated]: Key extends `${infer M} ${infer P extends ApiPath}`
        ? M extends MethodOf<P>
          ? {
              [Status in keyof Generated[Key]]: Same<
                z.infer<Generated[Key][Status] & z.ZodType>,
                ResponseBody<P, M, Status & keyof Responses<P, M>>
              > extends true
                ? never
                : `${Key} ${Status & number}`;
            }[keyof Generated[Key]]
          : Key
        : Key;
    }[keyof Generated];
    expectTypeOf<Mismatched>().toBeNever();
  });

  test("every JSON request body infers exactly its RequestBody", () => {
    type Generated = typeof requests;
    type Mismatched = {
      [Key in keyof Generated]: Key extends `${infer M} ${infer P extends ApiPath}`
        ? M extends MethodOf<P>
          ? Same<z.infer<Generated[Key]>, RequestBody<P, M>> extends true
            ? never
            : Key
          : Key
        : Key;
    }[keyof Generated];
    expectTypeOf<Mismatched>().toBeNever();
  });

  test("every operation lists its success statuses", () => {
    expect(successStatuses["post /v1/organizations/{organization_id}/claims"]).toEqual([201]);
    expect(
      successStatuses["post /v1/organizations/{organization_id}/claims/{claim_id}/reports"],
    ).toEqual([202]);
    expect(successStatuses["delete /v1/organizations/{organization_id}"]).toEqual([204]);
    // Completing an upload twice answers 200 with the same photo; the first time, 201.
    expect(
      successStatuses[
        "post /v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads/{upload_id}/complete"
      ],
    ).toEqual([200, 201]);
  });
});

describe("schemas", () => {
  test("accept what the API sends", () => {
    const tag = { tag: "ceiling", photos: 3 };
    expect(schemas.TagCount.parse(tag)).toEqual(tag);
    // Pydantic writes UTC as `Z` and keeps microseconds; offsets appear too.
    const at = schemas.ShareRead.shape.created_at;
    for (const value of [
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:00.123456Z",
      "2026-11-16T06:00:00-06:00",
    ]) {
      expect(at.safeParse(value).success, value).toBe(true);
    }
    // uuid7, as the API issues them.
    expect(
      schemas.ShareRead.shape.id.safeParse("0198a2c4-7b1e-7cc0-8000-000000000001").success,
    ).toBe(true);
  });

  test("reject what the contract rules out", () => {
    expect(schemas.ClaimStatus.safeParse("lost").success).toBe(false);
    expect(schemas.TagCount.safeParse({ tag: "ceiling" }).success).toBe(false); // photos missing
    expect(schemas.TagCount.safeParse({ tag: "ceiling", photos: 1.5 }).success).toBe(false);
    expect(schemas.ShareRead.shape.id.safeParse("not-a-uuid").success).toBe(false);
    expect(schemas.ShareRead.shape.created_at.safeParse("2026-11-16 12:00").success).toBe(false);
  });

  test("keep the request rules, so forms can reuse them", () => {
    const address = { line1: "123 Main St", city: "Austin", region: "TX", postal_code: "78701" };
    expect(schemas.AddressInput.safeParse(address).success).toBe(true);
    expect(schemas.AddressInput.safeParse({ ...address, city: "" }).success).toBe(false);
    expect(schemas.AddressInput.safeParse({ ...address, county: "Travis" }).success).toBe(false);
    expect(schemas.PhotoReportOptions.safeParse({ photos_per_page: 4 }).success).toBe(true);
    expect(schemas.PhotoReportOptions.safeParse({ photos_per_page: 3 }).success).toBe(false);
  });

  test("operations without a named schema still get one", () => {
    const list = responses["get /v1/organizations/{organization_id}/photo-tags"][200];
    expect(list.safeParse([{ tag: "ceiling", photos: 3 }]).success).toBe(true);
    expect(list.safeParse({ tag: "ceiling", photos: 3 }).success).toBe(false);
  });
});

describe("workflows", () => {
  test("cover every status, and lead only to real ones", () => {
    for (const [name, workflow] of [
      ["ClaimStatus", workflows.ClaimStatus.transitions],
      ["ClaimStatus", workflows.ClaimStatus.reasonRequired],
      ["EstimateStatus", workflows.EstimateStatus.transitions],
    ] as const) {
      const statuses = new Set<string>(schemas[name].options);
      const targets: string[] = Object.values<readonly string[]>(workflow).flat();
      expect(new Set(Object.keys(workflow))).toEqual(statuses);
      expect(targets.filter((status) => !statuses.has(status))).toEqual([]);
    }
  });

  test("say what the API enforces", () => {
    expect(workflows.ClaimStatus.transitions.new).toEqual([
      "inspected",
      "in_progress",
      "on_hold",
      "cancelled",
    ]);
    expect(workflows.ClaimStatus.reasonRequired.closed).toEqual(["in_progress"]); // reopening
    expect(workflows.EstimateStatus.transitions.approved).toEqual(["draft"]);
  });

  test("are typed by status", () => {
    expectTypeOf<keyof typeof workflows.ClaimStatus.transitions>().toEqualTypeOf<
      Schema<"ClaimStatus">
    >();
    expectTypeOf<
      (typeof workflows.EstimateStatus.transitions)[Schema<"EstimateStatus">][number]
    >().toExtend<Schema<"EstimateStatus">>();
  });
});

describe("renderer", () => {
  const contract = (schema: unknown) => ({
    paths: {},
    components: { schemas: { Thing: schema } },
  });

  test("refuses keywords it doesn't understand", () => {
    expect(() => renderZod(contract({ oneOf: [{ type: "string" }] }))).toThrow(
      'Unsupported JSON Schema keyword "oneOf" at #Thing',
    );
    expect(() => renderZod(contract({ type: "string", format: "ipv4" }))).toThrow(
      'Unsupported string format "ipv4"',
    );
  });

  test("reads vendor extensions as annotations, and publishes workflows", () => {
    const source = renderZod(
      contract({
        type: "string",
        enum: ["open", "done"],
        "x-transitions": { open: ["done"], done: ["open"] },
      }),
    );

    expect(source).toContain('const Thing = z.enum(["open","done"]);');
    expect(source).toContain('Thing: {"transitions":{"open":["done"],"done":["open"]}},');
  });

  test("refuses recursive schemas", () => {
    expect(() =>
      renderZod(
        contract({ type: "object", properties: { next: { $ref: "#/components/schemas/Thing" } } }),
      ),
    ).toThrow("Recursive schemas aren't supported: Thing → Thing");
  });

  test("renders dictionaries and loose objects", () => {
    const source = renderZod(
      contract({
        type: "object",
        properties: { counts: { type: "object", additionalProperties: { type: "integer" } } },
        additionalProperties: true,
        required: ["counts"],
      }),
    );
    expect(source).toContain(
      "const Thing = z.looseObject({ counts: z.record(z.string(), z.int()) });",
    );
  });
});
