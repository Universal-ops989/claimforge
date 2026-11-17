import {
  Button,
  Inline,
  Input,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuTrigger,
} from "@claimforge/ui";
import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { hasFilters, NO_FILTERS, type ClaimFilters } from "./filters";
import { LOSS_TYPE_LABEL, STATUS_LABEL } from "./status";

/** How long the search waits after the last keystroke before asking the API. */
export const SEARCH_DELAY_MS = 300;

export interface FilterBarProps {
  filters: ClaimFilters;
  onChange: (filters: ClaimFilters) => void;
}

/** Search, status and loss type, for the claims list. */
export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [text, setText] = useState(filters.q);
  const [shown, setShown] = useState(filters.q);

  // The address changed under us (Back, a link, Clear filters): show what it says.
  if (filters.q !== shown) {
    setShown(filters.q);
    setText(filters.q);
  }

  // Ask once typing pauses, not on every keystroke.
  useEffect(() => {
    if (text.trim() === filters.q) return undefined;
    const timer = setTimeout(() => {
      onChange({ ...filters, q: text.trim() });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, filters, onChange]);

  return (
    <Inline gap={3} align="center" role="search" aria-label="Filter claims">
      <Input
        type="search"
        aria-label="Search claims"
        placeholder="Number, address, carrier, policy, contact"
        prefix={<Search aria-hidden="true" size={16} />}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        style={{ minWidth: "18rem" }}
      />
      <Choice
        label="Status"
        options={STATUS_LABEL}
        chosen={filters.status}
        onChange={(status) => {
          onChange({ ...filters, status });
        }}
      />
      <Choice
        label="Loss type"
        options={LOSS_TYPE_LABEL}
        chosen={filters.lossType}
        onChange={(lossType) => {
          onChange({ ...filters, lossType });
        }}
      />
      {hasFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<X aria-hidden="true" size={16} />}
          onClick={() => {
            onChange(NO_FILTERS);
          }}
        >
          Clear filters
        </Button>
      )}
    </Inline>
  );
}

interface ChoiceProps<Value extends string> {
  label: string;
  options: Record<Value, string>;
  chosen: Value[];
  onChange: (chosen: Value[]) => void;
}

/** A menu of options, any of which can be on; the button says which, or how many. */
function Choice<Value extends string>({ label, options, chosen, onChange }: ChoiceProps<Value>) {
  const values = Object.keys(options) as Value[];
  const [only] = chosen;
  const summary =
    chosen.length === 0
      ? label
      : chosen.length === 1 && only
        ? `${label}: ${options[only]}`
        : `${label}: ${String(chosen.length)}`;
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          trailingIcon={<ChevronDown aria-hidden="true" size={16} />}
        >
          {summary}
        </Button>
      </MenuTrigger>
      <MenuContent align="start">
        {values.map((value) => (
          <MenuCheckboxItem
            key={value}
            checked={chosen.includes(value)}
            onCheckedChange={(on) => {
              // Keep the order the options are listed in.
              onChange(values.filter((v) => (v === value ? on : chosen.includes(v))));
            }}
            onSelect={(event) => {
              event.preventDefault(); // stay open to pick several
            }}
          >
            {options[value]}
          </MenuCheckboxItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
