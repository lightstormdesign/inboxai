import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";
import { requireAuth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await requireAuth();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-zinc-200 bg-white md:w-56 md:border-r md:border-b-0">
        <div className="px-4 py-4"><Logo href="/app/inbox" /></div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 text-sm md:flex-col md:pb-0">
          <NavLink href="/app/inbox">Inbox</NavLink>
          <NavLink href="/app/publish">Publish</NavLink>
          <NavLink href="/app/settings/voice">Brand voice</NavLink>
          <NavLink href="/app/settings/connections">Connections</NavLink>
          <NavLink href="/app/settings/account">Account</NavLink>
        </nav>
        <div className="mt-auto hidden border-t border-zinc-100 p-4 text-xs text-zinc-500 md:block">
          <p className="truncate font-medium text-zinc-700">{workspace.name}</p>
          <p className="truncate">{user.email}</p>
          <form action={logoutAction} className="mt-2">
            <button className="text-brand-600 hover:underline">Log out</button>
          </form>
          <p className="mt-3 flex gap-2">
            <Link href="/privacy">Privacy</Link>·<Link href="/terms">Terms</Link>
          </p>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
