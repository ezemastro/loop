import { twMerge } from "tailwind-merge";
import { pageContentClassName } from "../bases/MainView";

/**
 * Column for every auth screen: a 420px form column that is a white card from `md` up and plain
 * page background on mobile. `extra` is appended last (e.g. padding overrides).
 */
export const authContentClassName = (extra?: string) =>
  twMerge(
    pageContentClassName(
      "form",
      "flex-1 justify-center gap-4 p-4 md:mb-8 md:mt-12 md:flex-none md:rounded-xl md:border md:border-stroke md:bg-white md:p-8",
    ),
    extra,
  );
