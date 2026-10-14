import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-mint text-on-accent",
  secondary: "bg-surface text-ink",
  accent: "bg-sun text-on-accent",
  danger: "bg-danger text-on-accent",
  ghost: "border-transparent bg-transparent text-ink shadow-none hover:border-ink hover:bg-muted",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

export function buttonStyles({ variant = "primary", size = "md", block = false }: StyleProps = {}) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap",
    "rounded-brutal border-[3px] border-ink font-bold uppercase tracking-wider",
    "shadow-brutal transition-[transform,box-shadow] duration-100",
    // Hover lifts the button; pressing pushes it into its shadow.
    "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg",
    "active:translate-x-1 active:translate-y-1 active:shadow-none",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    variants[variant],
    sizes[size],
    block && "w-full",
  );
}

type ButtonProps = ComponentProps<"button"> & StyleProps;

export function Button({ variant, size, block, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant, size, block }), className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** A Next.js `<Link>` styled as a button, for navigation actions. */
export function ButtonLink({ variant, size, block, className, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonStyles({ variant, size, block }), className)} {...props} />;
}
