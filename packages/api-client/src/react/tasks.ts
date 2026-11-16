/**
 * Tasks: each claim's to-do list, and the tasks assigned to the user across claims.
 *
 * The API orders a claim's tasks open first, then soonest due, so after any change the
 * lists are refetched rather than re-sorted here. Ticking a task off is the exception
 * that can't wait for that: `done` shows at once in every cached list and is undone if
 * the API refuses; the refetch then puts the task where it belongs.
 */
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { CursorPage, QueryParams, RequestBody, Schema } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { editPages, nextCursor } from "./pages";

type Task = Schema<"TaskRead">;

const TASKS = "/v1/organizations/{organization_id}/claims/{claim_id}/tasks";
const TASK = `${TASKS}/{task_id}` as const;
const MINE = "/v1/organizations/{organization_id}/tasks/assigned-to-me";

type TasksQuery = QueryParams<typeof TASKS, "get">;
type MyTasksQuery = Omit<QueryParams<typeof MINE, "get">, "cursor">;

// ─── Reading ─────────────────────────────────────────────────────────────────

/** A claim's tasks; `{ status: "open" }` or `"done"` narrows them. */
export function tasksQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: TasksQuery = {},
) {
  return queryOptions({
    queryKey: queryKeys.taskList(organizationId, claimId, query),
    queryFn: ({ signal }) =>
      api.get(TASKS, {
        path: { organization_id: organizationId, claim_id: claimId },
        query,
        signal,
      }),
  });
}

export function useTasks(organizationId: string, claimId: string, query: TasksQuery = {}) {
  return useQuery(tasksQuery(useApi(), organizationId, claimId, query));
}

/** Tasks assigned to the signed-in user on live claims, soonest due first. */
export function myTasksQuery(api: ApiClient, organizationId: string, query: MyTasksQuery = {}) {
  return infiniteQueryOptions({
    queryKey: queryKeys.myTaskList(organizationId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get(MINE, {
        path: { organization_id: organizationId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function useMyTasks(organizationId: string, query: MyTasksQuery = {}) {
  return useInfiniteQuery(myTasksQuery(useApi(), organizationId, query));
}

// ─── Cache upkeep ────────────────────────────────────────────────────────────

/** Every cached list a task of this claim can be in. */
function listsOf(organizationId: string, claimId: string): QueryKey[] {
  return [queryKeys.tasks(organizationId, claimId), queryKeys.myTasks(organizationId)];
}

/** Apply `edit` to the claim's task lists and the assigned-to-me pages alike. */
function editTasks(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  edit: (tasks: Task[]) => Task[],
): void {
  queryClient.setQueriesData<Task[]>(
    { queryKey: queryKeys.tasks(organizationId, claimId) },
    (tasks) => tasks && edit(tasks),
  );
  queryClient.setQueriesData<InfiniteData<CursorPage<Task>>>(
    { queryKey: queryKeys.myTasks(organizationId) },
    (pages) => editPages(pages, edit),
  );
}

function replaceTask(task: Task) {
  return (tasks: Task[]) => tasks.map((other) => (other.id === task.id ? task : other));
}

/** Refetch the lists (to re-sort) and the timeline (it gained an entry). */
async function refresh(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
): Promise<void> {
  await Promise.all(
    [...listsOf(organizationId, claimId), queryKeys.timelines(organizationId, claimId)].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

// ─── Changing ────────────────────────────────────────────────────────────────

export function useCreateTask(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<typeof TASKS, "post">) =>
      api.post(TASKS, { path: { organization_id: organizationId, claim_id: claimId }, body }),
    onSuccess: () => refresh(queryClient, organizationId, claimId),
  });
}

export interface TaskChange {
  taskId: string;
  changes: RequestBody<typeof TASK, "patch">;
}

/**
 * Edit, reassign, complete (`changes: { done: true }`) or reopen a task. Completing or
 * reopening shows at once and is undone if the API refuses.
 */
export function useUpdateTask(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, changes }: TaskChange) =>
      api.patch(TASK, {
        path: { organization_id: organizationId, claim_id: claimId, task_id: taskId },
        body: changes,
      }),
    onMutate: async ({ taskId, changes: { done } }) => {
      if (done === undefined || done === null) {
        return { before: [] };
      }
      const lists = listsOf(organizationId, claimId);
      await Promise.all(lists.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      const before = lists.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }));
      editTasks(queryClient, organizationId, claimId, (tasks) =>
        tasks.map((task) =>
          task.id === taskId
            ? { ...task, done, completed_at: done ? new Date().toISOString() : null }
            : task,
        ),
      );
      return { before };
    },
    onSuccess: (updated) => {
      editTasks(queryClient, organizationId, claimId, replaceTask(updated));
    },
    onError: (_error, _change, context) => {
      for (const [queryKey, data] of context?.before ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => refresh(queryClient, organizationId, claimId),
  });
}

/** Delete a task; only its creator or an admin may (403 `not_task_creator`). */
export function useDeleteTask(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      api.delete(TASK, {
        path: { organization_id: organizationId, claim_id: claimId, task_id: taskId },
      }),
    onSuccess: async (_, taskId) => {
      editTasks(queryClient, organizationId, claimId, (tasks) =>
        tasks.filter((task) => task.id !== taskId),
      );
      await refresh(queryClient, organizationId, claimId);
    },
  });
}
