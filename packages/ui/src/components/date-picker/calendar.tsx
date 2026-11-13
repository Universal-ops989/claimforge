import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayFlag,
  DayPicker,
  SelectionState,
  UI,
  type ClassNames,
  type DayPickerProps,
} from "react-day-picker";

import styles from "./calendar.module.css";

const CLASS_NAMES: Partial<ClassNames> = {
  [UI.Root]: styles.root,
  [UI.Months]: styles.months,
  [UI.Month]: styles.month,
  [UI.MonthCaption]: styles.caption,
  [UI.CaptionLabel]: styles.captionLabel,
  [UI.Nav]: styles.nav,
  [UI.PreviousMonthButton]: styles.navButton,
  [UI.NextMonthButton]: styles.navButton,
  [UI.MonthGrid]: styles.grid,
  [UI.Weekday]: styles.weekday,
  [UI.Day]: styles.day,
  [UI.DayButton]: styles.dayButton,
  [SelectionState.selected]: styles.selected,
  [SelectionState.range_start]: styles.rangeStart,
  [SelectionState.range_middle]: styles.rangeMiddle,
  [SelectionState.range_end]: styles.rangeEnd,
  [DayFlag.today]: styles.today,
  [DayFlag.outside]: styles.outside,
  [DayFlag.disabled]: styles.disabled,
  [DayFlag.hidden]: styles.hidden,
};

function Chevron({ orientation }: { orientation?: "up" | "down" | "left" | "right" }) {
  return orientation === "left" ? (
    <ChevronLeft aria-hidden="true" className={styles.chevron} />
  ) : (
    <ChevronRight aria-hidden="true" className={styles.chevron} />
  );
}

/** Calendar grid styled with design tokens. Used by DatePicker and DateRangePicker. */
export function Calendar(props: DayPickerProps) {
  return <DayPicker showOutsideDays classNames={CLASS_NAMES} components={{ Chevron }} {...props} />;
}
