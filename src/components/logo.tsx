import Link from "next/link";
import { brand } from "@/lib/brand";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-sm text-white">✦</span>
      {brand.name}
    </Link>
  );
}
