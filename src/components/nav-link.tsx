"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-lg px-3 py-2 ${active ? "bg-brand-50 font-medium text-brand-700" : "text-zinc-600 hover:bg-zinc-100"}`}
    >
      {children}
    </Link>
  );
}
