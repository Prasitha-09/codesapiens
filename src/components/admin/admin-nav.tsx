"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/submissions", label: "Review" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-brutal border-[3px] px-3 py-1.5 text-sm font-bold uppercase tracking-wide",
              active ? "border-ink bg-mint text-on-accent" : "border-ink/30 text-ink hover:border-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
