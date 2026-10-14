import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { className: "bg-sky", icon: "i" },
  success: { className: "bg-mint", icon: "✓" },
  warning: { className: "bg-sun", icon: "!" },
  danger: { className: "bg-danger", icon: "×" },
} as const;

// Alerts are bright fills, so all text inside (links included) uses the dark on-accent color.

export type AlertTone = keyof typeof tones;

type AlertProps = Omit<ComponentProps<"div">, "title"> & {
  tone?: AlertTone;
  title?: ReactNode;
};

export function Alert({ tone = "info", title, className, children, ...props }: AlertProps) {
  const { className: toneClass, icon } = tones[tone];
  return (
    <div
      className={cn("flex gap-3 rounded-brutal border-[3px] border-ink p-4 text-on-accent shadow-brutal", toneClass, className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center border-2 border-on-accent bg-on-accent font-mono font-bold text-ink"
      >
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="text-sm leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
