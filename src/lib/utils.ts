import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about our custom theme tokens (see globals.css) so that,
// e.g., `shadow-none` correctly overrides `shadow-brutal` instead of both being kept.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ["brutal-sm", "brutal", "brutal-lg"],
      radius: ["brutal"],
    },
  },
});

/** Merge conditional class names, letting later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
