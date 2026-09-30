import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center text-center">
      <div>
        <p className="text-5xl font-bold">404</p>
        <p className="mt-2 text-zinc-600">That page doesn&apos;t exist.</p>
        <Link href="/" className="mt-4 inline-block text-brand-600">Go home</Link>
      </div>
    </div>
  );
}
