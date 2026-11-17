import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  FormField,
  Input,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@claimforge/ui";
import { Bookmark, ChevronDown, Plus, Trash } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import { NAME_LIMIT, type SavedView, type ViewStore } from "./saved-views";

export interface ViewsMenuProps {
  store: ViewStore;
  /** The list's query now, as `viewQuery` writes it. */
  current: string;
  /** Open the list a view keeps. */
  onOpen: (query: string) => void;
}

/** Saved views of the claims list: open one, save the list as one, delete the one shown. */
export function ViewsMenu({ store, current, onOpen }: ViewsMenuProps) {
  const [views, setViews] = useState<SavedView[]>(() => store.list());
  const [naming, setNaming] = useState(false);
  const shown = views.find((view) => view.query === current);

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Bookmark aria-hidden="true" size={16} />}
            trailingIcon={<ChevronDown aria-hidden="true" size={16} />}
          >
            {shown ? `View: ${shown.name}` : "Views"}
          </Button>
        </MenuTrigger>
        <MenuContent align="start">
          {!store.available ? (
            <MenuLabel>This browser won't keep saved views</MenuLabel>
          ) : views.length === 0 ? (
            <MenuLabel>No saved views yet</MenuLabel>
          ) : (
            <>
              <MenuLabel>Saved views</MenuLabel>
              {views.map((view) => (
                <MenuCheckboxItem
                  key={view.id}
                  checked={view.id === shown?.id}
                  onSelect={() => {
                    onOpen(view.query);
                  }}
                >
                  {view.name}
                </MenuCheckboxItem>
              ))}
            </>
          )}
          <MenuSeparator />
          <MenuItem
            icon={<Plus aria-hidden="true" />}
            disabled={!store.available || current === "" || shown !== undefined}
            onSelect={() => {
              setNaming(true);
            }}
          >
            Save this view…
          </MenuItem>
          {shown && (
            <MenuItem
              icon={<Trash aria-hidden="true" />}
              tone="danger"
              onSelect={() => {
                store.remove(shown.id);
                setViews(store.list());
              }}
            >
              {`Delete "${shown.name}"`}
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
      <Dialog open={naming} onOpenChange={setNaming}>
        {naming && (
          <NameView
            onSave={(name) => {
              const result = store.save(name, current);
              if (result.ok) {
                setViews(store.list());
                setNaming(false);
              }
              return result.ok ? null : result.error;
            }}
          />
        )}
      </Dialog>
    </>
  );
}

/** The name dialog; `onSave` answers an error to show, or `null` once saved. */
function NameView({ onSave }: { onSave: (name: string) => string | null }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(onSave(name));
  };
  return (
    <DialogContent
      title="Save this view"
      description="Saved views stay in this browser, for this organization."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="primary" type="submit" form="name-view">
            Save view
          </Button>
        </>
      }
    >
      <form id="name-view" onSubmit={submit} noValidate>
        <FormField label="Name" error={error ?? undefined} required>
          <Input
            value={name}
            maxLength={NAME_LIMIT + 20}
            // The dialog opened to name the view; the name is all it asks for.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </FormField>
      </form>
    </DialogContent>
  );
}
