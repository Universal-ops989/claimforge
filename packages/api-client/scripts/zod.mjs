// Render the API's OpenAPI contract as Zod schemas (src/zod.gen.ts).
//
// Covers the JSON Schema that Pydantic emits, and throws on anything else so a new
// construct in the contract fails the build instead of being validated loosely.

/** Keywords that only describe; they never change what's valid. */
const ANNOTATIONS = new Set([
  "title",
  "description",
  "examples",
  "default",
  "readOnly",
  "writeOnly",
  "deprecated",
]);

/** Keywords this renderer turns into checks. */
const CHECKS = new Set([
  "$ref",
  "anyOf",
  "const",
  "enum",
  "type",
  "format",
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "items",
  "minItems",
  "maxItems",
  "properties",
  "required",
  "additionalProperties",
]);

/**
 * Machine-made string formats worth checking. Emails are left to the API's validator.
 *
 * @type {Record<string, string>}
 */
const FORMATS = {
  uuid: "z.uuid()",
  "date-time": "z.iso.datetime({ offset: true })",
  date: "z.iso.date()",
  email: "z.string()",
};

/** @typedef {Record<string, any>} JsonSchema */

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const REF = "#/components/schemas/";

/**
 * @param {Record<string, any>} contract the parsed openapi.json
 * @returns {string} TypeScript source, without the "generated" header
 */
export function renderZod(contract) {
  const named = contract.components.schemas;
  const order = dependencyOrder(named);
  const lines = ['import { z } from "zod";', ""];

  for (const name of order) {
    if (!IDENTIFIER.test(name)) {
      throw new Error(`Schema name ${name} isn't a valid identifier`);
    }
    lines.push(`const ${name} = ${render(named[name], `#${name}`)};`);
  }

  lines.push(
    "",
    "/** Every named schema in the contract, by name: `schemas.ClaimRead`. */",
    "export const schemas = {",
    ...order.map((name) => `  ${name},`),
    "};",
    "",
    "/** Success bodies by operation (`get /v1/me`) and status. */",
    "export const responses = {",
  );
  for (const [path, operations] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const bodies = Object.entries(operation.responses).flatMap(([status, response]) => {
        const schema = response.content?.["application/json"]?.schema;
        return /^2\d\d$/.test(status) && schema
          ? [`${status}: ${render(schema, `${method} ${path} ${status}`)}`]
          : [];
      });
      if (bodies.length > 0) {
        lines.push(`  ${JSON.stringify(`${method} ${path}`)}: { ${bodies.join(", ")} },`);
      }
    }
  }
  lines.push(
    "};",
    "",
    "/** JSON request bodies by operation (`post /v1/auth/login`). */",
    "export const requests = {",
  );
  for (const [path, operations] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const schema = operation.requestBody?.content?.["application/json"]?.schema;
      if (schema) {
        const key = JSON.stringify(`${method} ${path}`);
        lines.push(`  ${key}: ${render(schema, `${method} ${path} body`)},`);
      }
    }
  }
  lines.push(
    "};",
    "",
    "/** The success statuses of every operation, in the contract's order. */",
    "export const successStatuses: Record<string, readonly number[]> = {",
  );
  for (const [path, operations] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const statuses = Object.keys(operation.responses).filter((status) => /^2\d\d$/.test(status));
      lines.push(`  ${JSON.stringify(`${method} ${path}`)}: [${statuses.join(", ")}],`);
    }
  }
  lines.push("};", "");
  return lines.join("\n");
}

/**
 * Schema names ordered so each comes after the ones it refers to.
 *
 * @param {Record<string, JsonSchema>} named
 * @returns {string[]}
 */
function dependencyOrder(named) {
  /** @type {string[]} */
  const order = [];
  /** @type {Map<string, "visiting" | "done">} */
  const state = new Map();
  /** @type {(name: string, trail: string[]) => void} */
  const visit = (name, trail) => {
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") {
      throw new Error(`Recursive schemas aren't supported: ${[...trail, name].join(" → ")}`);
    }
    state.set(name, "visiting");
    for (const ref of references(named[name])) visit(ref, [...trail, name]);
    state.set(name, "done");
    order.push(name);
  };
  for (const name of Object.keys(named)) visit(name, []);
  return order;
}

/**
 * @param {unknown} schema
 * @returns {string[]}
 */
function references(schema) {
  if (Array.isArray(schema)) return schema.flatMap(references);
  if (typeof schema !== "object" || schema === null) return [];
  return Object.entries(schema).flatMap(([key, value]) =>
    key === "$ref" ? [refName(value)] : references(value),
  );
}

/**
 * @param {string} ref
 * @returns {string}
 */
function refName(ref) {
  if (!ref.startsWith(REF)) throw new Error(`Unsupported $ref ${ref}`);
  return ref.slice(REF.length);
}

/**
 * @param {JsonSchema | boolean} schema
 * @param {string} where for error messages
 * @returns {string}
 */
function render(schema, where) {
  if (schema === true || (typeof schema === "object" && isEmpty(schema))) return "z.unknown()";
  if (schema === false) throw new Error(`A schema that accepts nothing at ${where}`);
  for (const key of Object.keys(schema)) {
    if (!ANNOTATIONS.has(key) && !CHECKS.has(key)) {
      throw new Error(`Unsupported JSON Schema keyword "${key}" at ${where}`);
    }
  }

  if (schema.$ref) return refName(schema.$ref);
  if (schema.anyOf) return union(schema.anyOf, where);
  if ("const" in schema) return `z.literal(${JSON.stringify(schema.const)})`;
  if (schema.enum) return enumeration(schema.enum);

  switch (schema.type) {
    case "string":
      return string(schema);
    case "integer":
      return numeric("z.int()", schema);
    case "number":
      return numeric("z.number()", schema);
    case "boolean":
      return "z.boolean()";
    case "null":
      return "z.null()";
    case "array":
      return array(schema, where);
    case "object":
      return object(schema, where);
    default:
      throw new Error(`Unsupported type ${JSON.stringify(schema.type)} at ${where}`);
  }
}

/**
 * @param {JsonSchema} schema
 * @returns {boolean}
 */
function isEmpty(schema) {
  return Object.keys(schema).every((key) => ANNOTATIONS.has(key));
}

/**
 * @param {JsonSchema[]} options
 * @param {string} where
 * @returns {string}
 */
function union(options, where) {
  const present = options.filter((option) => option.type !== "null");
  const nullable = present.length < options.length;
  const rendered = present.map((option, i) => render(option, `${where} anyOf[${String(i)}]`));
  const [only] = rendered;
  const base = rendered.length === 1 && only ? only : `z.union([${rendered.join(", ")}])`;
  return nullable ? `${base}.nullable()` : base;
}

/**
 * @param {unknown[]} values
 * @returns {string}
 */
function enumeration(values) {
  if (values.every((value) => typeof value === "string")) {
    return `z.enum(${JSON.stringify(values)})`;
  }
  const literals = values.map((value) => `z.literal(${JSON.stringify(value)})`);
  const [only] = literals;
  return literals.length === 1 && only ? only : `z.union([${literals.join(", ")}])`;
}

/**
 * @param {JsonSchema} schema
 * @returns {string}
 */
function string(schema) {
  const format = schema.format === undefined ? "z.string()" : FORMATS[schema.format];
  if (format === undefined) {
    throw new Error(`Unsupported string format "${String(schema.format)}"`);
  }
  let out = format;
  if (schema.minLength !== undefined) out += `.min(${String(schema.minLength)})`;
  if (schema.maxLength !== undefined) out += `.max(${String(schema.maxLength)})`;
  if (schema.pattern !== undefined) out += `.regex(new RegExp(${JSON.stringify(schema.pattern)}))`;
  return out;
}

/**
 * @param {string} base
 * @param {JsonSchema} schema
 * @returns {string}
 */
function numeric(base, schema) {
  let out = base;
  if (schema.minimum !== undefined) out += `.min(${String(schema.minimum)})`;
  if (schema.exclusiveMinimum !== undefined) out += `.gt(${String(schema.exclusiveMinimum)})`;
  if (schema.maximum !== undefined) out += `.max(${String(schema.maximum)})`;
  if (schema.exclusiveMaximum !== undefined) out += `.lt(${String(schema.exclusiveMaximum)})`;
  return out;
}

/**
 * @param {JsonSchema} schema
 * @param {string} where
 * @returns {string}
 */
function array(schema, where) {
  let out = `z.array(${schema.items === undefined ? "z.unknown()" : render(schema.items, `${where}[]`)})`;
  if (schema.minItems !== undefined) out += `.min(${String(schema.minItems)})`;
  if (schema.maxItems !== undefined) out += `.max(${String(schema.maxItems)})`;
  return out;
}

/**
 * @param {JsonSchema} schema
 * @param {string} where
 * @returns {string}
 */
function object(schema, where) {
  const extra = schema.additionalProperties;
  const properties = Object.entries(schema.properties ?? {});
  if (properties.length === 0) {
    // A dictionary: `dict[str, int]` and the like.
    const values =
      extra === undefined || extra === true ? "z.unknown()" : render(extra, `${where}{}`);
    if (extra === false) return "z.strictObject({})";
    return `z.record(z.string(), ${values})`;
  }

  const required = new Set(schema.required ?? []);
  const fields = properties.map(([key, value]) => {
    const rendered = render(value, `${where}.${key}`);
    const label = IDENTIFIER.test(key) ? key : JSON.stringify(key);
    return `${label}: ${rendered}${required.has(key) ? "" : ".optional()"}`;
  });
  const shape = `{ ${fields.join(", ")} }`;
  if (extra === false) return `z.strictObject(${shape})`;
  if (extra === true) return `z.looseObject(${shape})`;
  if (extra === undefined) return `z.object(${shape})`;
  return `z.object(${shape}).catchall(${render(extra, `${where}{}`)})`;
}
