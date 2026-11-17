import { readFilters, writeFilters } from "./filters";
import { readSort, writeSort } from "./sort";

/** A name for a filtered, sorted claims list. */
export interface SavedView {
  id: string;
  name: string;
  /** The list's query, as `viewQuery` writes it: `status=on_hold&loss_type=water&sort=…`. */
  query: string;
}

export const NAME_LIMIT = 60;

/**
 * The part of an address a view keeps, written the same way every time, so a view
 * matches the list it opens however the address was typed.
 */
export function viewQuery(params: URLSearchParams): string {
  return writeSort(
    writeFilters(new URLSearchParams(), readFilters(params)),
    readSort(params),
  ).toString();
}

export type SaveResult = { ok: true; view: SavedView } | { ok: false; error: string };

export interface ViewStore {
  /** False when the browser refuses storage: nothing can be saved. */
  available: boolean;
  list: () => SavedView[];
  save: (name: string, query: string) => SaveResult;
  remove: (id: string) => void;
}

const keyFor = (organizationId: string) => `claimforge.claim-views.${organizationId}`;

function isView(value: unknown): value is SavedView {
  if (typeof value !== "object" || value === null) return false;
  const { id, name, query } = value as Record<string, unknown>;
  return typeof id === "string" && typeof name === "string" && typeof query === "string";
}

/** The saved views of one organization, in `storage` (this browser's `localStorage`). */
export function createViewStore(storage: Storage | null, organizationId: string): ViewStore {
  const key = keyFor(organizationId);

  const read = (): SavedView[] => {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(key) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isView) : [];
    } catch {
      return [];
    }
  };

  const write = (views: SavedView[]): boolean => {
    try {
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(views));
      return true;
    } catch {
      return false;
    }
  };

  const available = (() => {
    try {
      if (!storage) return false;
      storage.setItem(`${key}.probe`, "1");
      storage.removeItem(`${key}.probe`);
      return true;
    } catch {
      return false;
    }
  })();

  return {
    available,
    list: read,
    save: (rawName, query) => {
      const name = rawName.trim();
      if (!name) return { ok: false, error: "Give the view a name." };
      if (name.length > NAME_LIMIT) {
        return { ok: false, error: `Keep the name to ${String(NAME_LIMIT)} characters or fewer.` };
      }
      const views = read();
      if (views.some((view) => view.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false, error: `There's already a view called "${name}".` };
      }
      const view: SavedView = { id: crypto.randomUUID(), name, query };
      if (!write([...views, view])) {
        return { ok: false, error: "This browser won't keep saved views." };
      }
      return { ok: true, view };
    },
    remove: (id) => {
      write(read().filter((view) => view.id !== id));
    },
  };
}
