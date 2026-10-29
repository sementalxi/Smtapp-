import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="font-display text-8xl text-lime">404</div>
      <Link href="/" className="btn-ghost mt-8">←</Link>
    </div>
  );
}
