// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Schema } from "../index";
import {
  allItems,
  useCreateTask,
  useDeleteTask,
  useMyTasks,
  useTasks,
  useUpdateTask,
} from "./index";
import {
  CLAIM_ID,
  CLAIM_NUMBER,
  FakeServer,
  json,
  MORGAN,
  noContent,
  ORG_ID,
  problem,
  renderWithApi,
} from "./testing";

afterEach(cleanup);

const TASKS = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}/tasks`;
const MINE = `/v1/organizations/${ORG_ID}/tasks/assigned-to-me`;

function task(n: number, title: string, done = false): Schema<"TaskRead"> {
  return {
    id: `0198a2c4-7b1e-7cc0-8000-00000000030${String(n)}`,
    claim: { id: CLAIM_ID, number: CLAIM_NUMBER },
    title,
    description: null,
    due_on: "2026-11-18",
    done,
    completed_at: done ? "2026-11-16T12:00:00Z" : null,
    completed_by_id: done ? MORGAN.id : null,
    assignee: MORGAN,
    created_by_id: MORGAN.id,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
  };
}

const SET_DRYERS = task(1, "Set dryers");
const CALL_ADJUSTER = task(2, "Call the adjuster");

/** The claim's list and "assigned to me" both serve `tasks`; `gets(path)` counts GETs. */
function taskServer(tasks: () => Schema<"TaskRead">[]) {
  const server = new FakeServer()
    .on("GET", TASKS, () => json(tasks()))
    .on("GET", MINE, () => json({ items: tasks(), next_cursor: null, has_more: false }));
  const gets = (path: string) =>
    server.calls.filter(
      (call) => call.startsWith(`GET ${path}?`) || call.startsWith(`GET ${path} `),
    ).length;
  return { server, gets };
}

/** Both lists loaded, with the given mutation hook alongside. */
async function withTasks<Mutation>(server: FakeServer, useMutation: () => Mutation) {
  const rendered = renderWithApi(
    () => ({
      claim: useTasks(ORG_ID, CLAIM_ID),
      mine: useMyTasks(ORG_ID),
      change: useMutation(),
    }),
    { server },
  );
  await waitFor(() => {
    // Read `data`, not just a status: hooks re-render only for what was read.
    const { claim, mine } = rendered.result.current;
    expect(claim.data && mine.data).toBeDefined();
  });
  return rendered;
}

const done = (tasks: Schema<"TaskRead">[] | undefined) =>
  tasks?.map((t) => `${t.title}${t.done ? " ✓" : ""}`);

describe("reading", () => {
  test("a claim's list can be narrowed to open or done tasks", async () => {
    const { server } = taskServer(() => [SET_DRYERS]);

    const { result } = renderWithApi(() => useTasks(ORG_ID, CLAIM_ID, { status: "open" }), {
      server,
    });

    await waitFor(() => {
      expect(done(result.current.data)).toEqual(["Set dryers"]);
    });
    expect(server.calls).toEqual([`GET ${TASKS}?status=open access-1`]);
  });
});

describe("ticking a task off", () => {
  test("shows in every list before the API answers", async () => {
    let tasks = [SET_DRYERS, CALL_ADJUSTER];
    let answer: () => void = () => undefined;
    const { server, gets } = taskServer(() => tasks);
    server.on(
      "PATCH",
      `${TASKS}/${SET_DRYERS.id}`,
      () =>
        new Promise((resolve) => {
          answer = () => {
            // Done tasks sort after open ones.
            tasks = [CALL_ADJUSTER, task(1, "Set dryers", true)];
            resolve(json(tasks[1]));
          };
        }),
    );
    const { result } = await withTasks(server, () => useUpdateTask(ORG_ID, CLAIM_ID));

    act(() => {
      result.current.change.mutate({ taskId: SET_DRYERS.id, changes: { done: true } });
    });

    await waitFor(() => {
      expect(done(result.current.claim.data)).toEqual(["Set dryers ✓", "Call the adjuster"]);
    });
    expect(done(allItems(result.current.mine.data))).toEqual(["Set dryers ✓", "Call the adjuster"]);
    expect(result.current.change.isPending).toBe(true);

    act(() => {
      answer();
    });

    // The refetch puts the done task where the API sorts it.
    await waitFor(() => {
      expect(done(result.current.claim.data)).toEqual(["Call the adjuster", "Set dryers ✓"]);
    });
    expect(gets(TASKS)).toBe(2);
    expect(gets(MINE)).toBe(2);
  });

  test("is undone in every list if the API refuses", async () => {
    let hold = false;
    const { server } = taskServer(() => [SET_DRYERS]);
    const serve = server.fetch;
    // After the refusal the refetch never answers, so only the rollback can undo the tick.
    server.fetch = (input, init) =>
      hold && (init?.method ?? "GET") === "GET"
        ? new Promise<Response>(() => undefined)
        : serve(input, init);
    server.on("PATCH", `${TASKS}/${SET_DRYERS.id}`, () => {
      hold = true;
      return problem(409, "claim_locked");
    });
    const { result } = await withTasks(server, () => useUpdateTask(ORG_ID, CLAIM_ID));

    act(() => {
      result.current.change.mutate({ taskId: SET_DRYERS.id, changes: { done: true } });
    });
    await waitFor(() => {
      expect(hold).toBe(true); // refused (the tick itself is the test above)
    });

    await waitFor(() => {
      expect(done(result.current.claim.data)).toEqual(["Set dryers"]);
    });
    expect(done(allItems(result.current.mine.data))).toEqual(["Set dryers"]);
  });

  test("other edits wait for the answer", async () => {
    const renamed = { ...SET_DRYERS, title: "Set four dryers" };
    let answer: () => void = () => undefined;
    let tasks = [SET_DRYERS];
    const { server } = taskServer(() => tasks);
    server.on(
      "PATCH",
      `${TASKS}/${SET_DRYERS.id}`,
      () =>
        new Promise((resolve) => {
          answer = () => {
            tasks = [renamed];
            resolve(json(renamed));
          };
        }),
    );
    const { result } = await withTasks(server, () => useUpdateTask(ORG_ID, CLAIM_ID));

    act(() => {
      result.current.change.mutate({ taskId: SET_DRYERS.id, changes: { title: renamed.title } });
    });
    await waitFor(() => {
      expect(result.current.change.isPending).toBe(true);
    });
    expect(done(result.current.claim.data)).toEqual(["Set dryers"]);

    act(() => {
      answer();
    });
    await waitFor(() => {
      expect(done(result.current.claim.data)).toEqual(["Set four dryers"]);
    });
  });
});

describe("adding and removing", () => {
  test("a new task refetches both lists", async () => {
    let tasks = [SET_DRYERS];
    const { server, gets } = taskServer(() => tasks);
    server.on("POST", TASKS, () => {
      tasks = [CALL_ADJUSTER, SET_DRYERS];
      return json(CALL_ADJUSTER, 201);
    });
    const { result } = await withTasks(server, () => useCreateTask(ORG_ID, CLAIM_ID));

    await act(() =>
      result.current.change.mutateAsync({ title: CALL_ADJUSTER.title, assignee_id: MORGAN.id }),
    );

    await waitFor(() => {
      expect(done(allItems(result.current.mine.data))).toEqual(["Call the adjuster", "Set dryers"]);
    });
    expect(gets(TASKS)).toBe(2);
  });

  test("a deleted task leaves every list without waiting for the refetch", async () => {
    let tasks = [SET_DRYERS, CALL_ADJUSTER];
    let hold = false;
    const server = new FakeServer()
      .on("GET", TASKS, () => (hold ? new Promise<Response>(() => undefined) : json(tasks)))
      .on("GET", MINE, () =>
        hold
          ? new Promise<Response>(() => undefined)
          : json({ items: tasks, next_cursor: null, has_more: false }),
      )
      .on("DELETE", `${TASKS}/${SET_DRYERS.id}`, () => {
        tasks = [CALL_ADJUSTER];
        hold = true; // the refetch that follows never answers
        return noContent();
      });
    const { result } = await withTasks(server, () => useDeleteTask(ORG_ID, CLAIM_ID));

    act(() => {
      result.current.change.mutate(SET_DRYERS.id);
    });

    await waitFor(() => {
      expect(done(result.current.claim.data)).toEqual(["Call the adjuster"]);
    });
    expect(done(allItems(result.current.mine.data))).toEqual(["Call the adjuster"]);
    expect(result.current.claim.isFetching).toBe(true);
  });
});
