"use client";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
export function LegacyAdminHeader({children}:{children:ReactNode}) {
 const pathname=usePathname();
 return ["/admin","/admin/teams","/admin/rounds","/admin/questions","/admin/submissions","/admin/scores","/admin/settings"].includes(pathname)?null:<>{children}</>;
}
