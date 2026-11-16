// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { UploadError, type Schema } from "../index";
import {
  allItems,
  photoQuery,
  photosQuery,
  PROCESSING_POLL_MS,
  useDeletePhoto,
  useDocuments,
  usePhotos,
  usePhotoTags,
  useUpdatePhoto,
  useUpdateRoom,
  useUploadDocument,
  useUploadPhoto,
} from "./index";
import { CLAIM_ID, FakeServer, json, MORGAN, noContent, ORG_ID, renderWithApi } from "./testing";

afterEach(cleanup);

const CLAIM = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}`;
const KITCHEN = { id: "0198a2c4-7b1e-7cc0-8000-000000000201", name: "Kitchen" };
const UPLOAD_ID = "0198a2c4-7b1e-7cc0-8000-000000000599";

function photo(n: number, changes: Partial<Schema<"PhotoRead">> = {}): Schema<"PhotoRead"> {
  const id = `0198a2c4-7b1e-7cc0-8000-00000000050${String(n)}`;
  return {
    id,
    claim_id: CLAIM_ID,
    filename: `IMG_00${String(n)}.jpg`,
    content_type: "image/jpeg",
    size_bytes: 2_048,
    caption: null,
    tags: [],
    room: KITCHEN,
    taken_at: null,
    processing: "ready",
    width: 4032,
    height: 3024,
    url: `https://storage.test/${id}`,
    download_url: `https://storage.test/${id}?download`,
    preview_url: null,
    thumbnail_url: `https://storage.test/${id}/thumb`,
    uploaded_by: MORGAN,
    created_at: "2026-11-16T12:00:00Z",
    ...changes,
  };
}

const page = <Item,>(items: Item[]) => ({ items, next_cursor: null, has_more: false });

const signedLink = {
  url: "https://storage.test/bucket/upload.jpg?X-Amz-Signature=secret",
  method: "PUT" as const,
  headers: { "Content-Type": "image/jpeg" },
  expires_at: "2099-01-01T00:00:00Z",
};

const jpeg = (name = "IMG_0003.jpg", type = "image/jpeg") =>
  new File(["jpeg bytes"], name, { type });

/** GETs of exactly `path`, whatever their query string. */
const gets = (server: FakeServer, path: string) =>
  server.calls.filter((call) => call.startsWith(`GET ${path}?`) || call.startsWith(`GET ${path} `))
    .length;

/**
 * Photos: the whole claim's list shows photo 1, Kitchen's list the same. Uploading
 * answers with photo 3; storage takes any PUT.
 */
function photoServer() {
  const sent: unknown[] = [];
  const server = new FakeServer()
    .on("GET", `${CLAIM}/photos`, () => json(page([photo(1)])))
    .on("GET", `/v1/organizations/${ORG_ID}/photo-tags`, () => json([]))
    .on("POST", `${CLAIM}/photo-uploads`, async (request) => {
      sent.push(await request.json());
      return json({ id: UPLOAD_ID, upload: signedLink }, 201);
    })
    .on("PUT", "/bucket/upload.jpg", () => new Response(null, { status: 200 }))
    .on("POST", `${CLAIM}/photo-uploads/${UPLOAD_ID}/complete`, () =>
      json(
        photo(3, { processing: "pending", thumbnail_url: null, width: null, height: null }),
        201,
      ),
    );
  return { server, sent };
}

/** The whole claim's photos and Kitchen's, loaded, with a mutation alongside. */
async function withPhotos<Mutation>(server: FakeServer, useMutation: () => Mutation) {
  const rendered = renderWithApi(
    () => ({
      all: usePhotos(ORG_ID, CLAIM_ID),
      kitchen: usePhotos(ORG_ID, CLAIM_ID, { room_id: KITCHEN.id }),
      change: useMutation(),
    }),
    { server },
  );
  await waitFor(() => {
    const { all, kitchen } = rendered.result.current;
    expect(all.data && kitchen.data).toBeDefined();
  });
  return rendered;
}

const ids = (photos: Schema<"PhotoRead">[]) => photos.map((p) => p.filename);

describe("uploading a photo", () => {
  test("takes the three steps, the file going to storage without the token", async () => {
    const { server, sent } = photoServer();
    const { result } = await withPhotos(server, () => useUploadPhoto(ORG_ID, CLAIM_ID));

    await act(() =>
      result.current.change.mutateAsync({
        file: jpeg(),
        room_id: KITCHEN.id,
        tags: ["before"],
      }),
    );

    expect(sent).toEqual([
      {
        room_id: KITCHEN.id,
        tags: ["before"],
        filename: "IMG_0003.jpg",
        content_type: "image/jpeg",
        size_bytes: 10,
      },
    ]);
    expect(server.calls.filter((call) => !call.startsWith("GET"))).toEqual([
      `POST ${CLAIM}/photo-uploads access-1`,
      "PUT /bucket/upload.jpg?X-Amz-Signature=secret -",
      `POST ${CLAIM}/photo-uploads/${UPLOAD_ID}/complete access-1`,
    ]);
  });

  test("goes on top of the unfiltered list; filtered lists refetch", async () => {
    const { server } = photoServer();
    const { result } = await withPhotos(server, () => useUploadPhoto(ORG_ID, CLAIM_ID));

    await act(() => result.current.change.mutateAsync({ file: jpeg(), room_id: KITCHEN.id }));

    await waitFor(() => {
      expect(ids(allItems(result.current.all.data))).toEqual(["IMG_003.jpg", "IMG_001.jpg"]);
    });
    expect(gets(server, `${CLAIM}/photos`)).toBe(3); // two first loads, one refetch: Kitchen's
  });

  test("a file the API won't take fails before any request", async () => {
    const { server } = photoServer();
    const { result } = await withPhotos(server, () => useUploadPhoto(ORG_ID, CLAIM_ID));
    const before = server.calls.length;

    const error = await act(() =>
      result.current.change
        .mutateAsync({ file: jpeg("animation.gif", "image/gif") })
        .catch((e: unknown) => e),
    );

    expect(error).toBeInstanceOf(UploadError);
    expect(error).toMatchObject({ reason: "invalid" });
    expect((error as Error).message).toContain("content_type");
    expect(server.calls.length).toBe(before);
  });

  test("a type the browser left blank can be given", async () => {
    const { server, sent } = photoServer();
    const { result } = await withPhotos(server, () => useUploadPhoto(ORG_ID, CLAIM_ID));

    await act(() =>
      result.current.change.mutateAsync({
        file: jpeg("IMG_0003.HEIC", ""),
        content_type: "image/heic",
      }),
    );

    expect(sent).toMatchObject([{ filename: "IMG_0003.HEIC", content_type: "image/heic" }]);
  });
});

describe("photos already there", () => {
  test("while a thumbnail is being made, the list and the photo ask again", () => {
    const { api } = renderWithApi(() => undefined);
    const list = photosQuery(api, ORG_ID, CLAIM_ID);
    const one = photoQuery(api, ORG_ID, CLAIM_ID, photo(1).id);
    const interval = (options: { refetchInterval?: unknown }, data: unknown) =>
      (options.refetchInterval as (query: { state: { data: unknown } }) => number | false)({
        state: { data },
      });
    const listOf = (...photos: Schema<"PhotoRead">[]) => ({
      pages: [page(photos)],
      pageParams: [],
    });

    expect(interval(list, listOf(photo(1), photo(2, { processing: "pending" })))).toBe(
      PROCESSING_POLL_MS,
    );
    expect(interval(list, listOf(photo(1), photo(2, { processing: "failed" })))).toBe(false);
    expect(interval(one, photo(1, { processing: "pending" }))).toBe(PROCESSING_POLL_MS);
    expect(interval(one, photo(1))).toBe(false);
  });

  test("an edit lands in the unfiltered list; filtered lists and tags refetch", async () => {
    const { server } = photoServer();
    const tagged = photo(1, { tags: ["ceiling"], room: null });
    server.on("PATCH", `${CLAIM}/photos/${tagged.id}`, () => json(tagged));
    const { result } = renderWithApi(
      () => ({
        all: usePhotos(ORG_ID, CLAIM_ID),
        kitchen: usePhotos(ORG_ID, CLAIM_ID, { room_id: KITCHEN.id }),
        tags: usePhotoTags(ORG_ID, { prefix: "ce" }),
        change: useUpdatePhoto(ORG_ID, CLAIM_ID),
      }),
      { server },
    );
    await waitFor(() => {
      const { all, kitchen, tags } = result.current;
      expect(all.data && kitchen.data && tags.data).toBeDefined();
    });

    await act(() =>
      result.current.change.mutateAsync({
        photoId: tagged.id,
        changes: { tags: ["ceiling"], room_id: null },
      }),
    );

    await waitFor(() => {
      expect(allItems(result.current.all.data)[0]?.tags).toEqual(["ceiling"]);
    });
    expect(gets(server, `${CLAIM}/photos`)).toBe(3);
    expect(gets(server, `/v1/organizations/${ORG_ID}/photo-tags`)).toBe(2);
  });

  test("a deleted photo leaves every list without a refetch", async () => {
    const { server } = photoServer();
    server.on("DELETE", `${CLAIM}/photos/${photo(1).id}`, noContent);
    const { result } = await withPhotos(server, () => useDeletePhoto(ORG_ID, CLAIM_ID));

    await act(() => result.current.change.mutateAsync(photo(1).id));

    await waitFor(() => {
      expect(allItems(result.current.all.data)).toEqual([]);
    });
    expect(allItems(result.current.kitchen.data)).toEqual([]);
    expect(gets(server, `${CLAIM}/photos`)).toBe(2);
  });

  test("renaming a room refreshes the photos that show its name", async () => {
    const { server } = photoServer();
    server.on("PATCH", `${CLAIM}/rooms/${KITCHEN.id}`, () =>
      json({
        id: KITCHEN.id,
        structure_id: "0198a2c4-7b1e-7cc0-8000-000000000101",
        name: "Galley kitchen",
        level: null,
        length_ft: null,
        width_ft: null,
        height_ft: null,
        floor_area_sqft: null,
        wall_area_sqft: null,
        volume_cuft: null,
        created_at: "2026-11-16T12:00:00Z",
        updated_at: "2026-11-16T12:00:00Z",
      }),
    );
    const { result } = await withPhotos(server, () => useUpdateRoom(ORG_ID, CLAIM_ID));
    const before = gets(server, `${CLAIM}/photos`);

    await act(() =>
      result.current.change.mutateAsync({
        roomId: KITCHEN.id,
        changes: { name: "Galley kitchen" },
      }),
    );

    expect(gets(server, `${CLAIM}/photos`)).toBe(before + 2);
  });
});

describe("documents", () => {
  const document = (n: number, category: Schema<"DocumentCategory">): Schema<"DocumentRead"> => ({
    id: `0198a2c4-7b1e-7cc0-8000-00000000060${String(n)}`,
    claim_id: CLAIM_ID,
    title: `Document ${String(n)}`,
    filename: `doc-${String(n)}.pdf`,
    category,
    content_type: "application/pdf",
    size_bytes: 10,
    view_url: null,
    download_url: "https://storage.test/doc?download",
    uploaded_by: MORGAN,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
  });

  test("an upload goes on top of the unfiltered list; category lists refetch", async () => {
    const sent: unknown[] = [];
    const server = new FakeServer()
      .on("GET", `${CLAIM}/documents`, () => json(page([document(1, "policy")])))
      .on("POST", `${CLAIM}/document-uploads`, async (request) => {
        sent.push(await request.json());
        return json({ id: UPLOAD_ID, upload: { ...signedLink, headers: {} } }, 201);
      })
      .on("PUT", "/bucket/upload.jpg", () => new Response(null, { status: 200 }))
      .on("POST", `${CLAIM}/document-uploads/${UPLOAD_ID}/complete`, () =>
        json(document(2, "authorization"), 201),
      );
    const { result } = renderWithApi(
      () => ({
        all: useDocuments(ORG_ID, CLAIM_ID),
        policies: useDocuments(ORG_ID, CLAIM_ID, { category: ["policy"] }),
        upload: useUploadDocument(ORG_ID, CLAIM_ID),
      }),
      { server },
    );
    await waitFor(() => {
      const { all, policies } = result.current;
      expect(all.data && policies.data).toBeDefined();
    });

    await act(() =>
      result.current.upload.mutateAsync({
        file: new File(["%PDF"], "signed.pdf", { type: "application/pdf" }),
        category: "authorization",
      }),
    );

    expect(sent).toEqual([
      {
        category: "authorization",
        filename: "signed.pdf",
        content_type: "application/pdf",
        size_bytes: 4,
      },
    ]);
    await waitFor(() => {
      expect(allItems(result.current.all.data).map((d) => d.title)).toEqual([
        "Document 2",
        "Document 1",
      ]);
    });
    expect(gets(server, `${CLAIM}/documents`)).toBe(3);
  });

  test("an empty file fails before any request", async () => {
    const server = new FakeServer();
    const { result } = renderWithApi(() => useUploadDocument(ORG_ID, CLAIM_ID), { server });

    const error = await act(() =>
      result.current
        .mutateAsync({ file: new File([], "blank.pdf", { type: "application/pdf" }) })
        .catch((e: unknown) => e),
    );

    expect(error).toMatchObject({ reason: "invalid" });
    expect((error as Error).message).toContain("size_bytes");
    expect(server.calls).toEqual([]);
  });
});
