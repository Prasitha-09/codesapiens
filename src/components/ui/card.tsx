import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Bright tones switch text (and inner borders) to the dark on-accent color.
const tones = {
  surface: "bg-surface text-ink",
  mint: "bg-mint text-on-accent [&_.border-ink]:border-on-accent [&_.text-subtle]:text-on-accent/75",
  sun: "bg-sun text-on-accent [&_.border-ink]:border-on-accent [&_.text-subtle]:text-on-accent/75",
  sky: "bg-sky text-on-accent [&_.border-ink]:border-on-accent [&_.text-subtle]:text-on-accent/75",
  pink: "bg-pink text-on-accent [&_.border-ink]:border-on-accent [&_.text-subtle]:text-on-accent/75",
  muted: "bg-muted text-ink",
} as const;

export type CardTone = keyof typeof tones;

type CardProps = ComponentProps<"div"> & {
  tone?: CardTone;
  /** Adds a hover lift; use only when the whole card is clickable. */
  interactive?: boolean;
};

export function Card({ tone = "surface", interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-brutal border-[3px] border-ink shadow-brutal",
        tones[tone],
        interactive &&
          "transition-[transform,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 border-b-[3px] border-ink p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-xl font-bold leading-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-subtle", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 border-t-[3px] border-ink p-5", className)}
      {...props}
    />
  );
}
