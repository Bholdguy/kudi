import Link from "next/link";
import { Logo } from "@/components/BrandMark";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-10">
      <Logo />
      <h1 className="mt-10 font-display text-5xl font-bold leading-tight tracking-tight">
        We can&apos;t find that page
      </h1>
      <p className="mt-4 max-w-[40ch] text-lg text-muted">
        The link may have a typo, or the page has moved. If someone sent you an invoice link, ask
        them for a fresh one.
      </p>
      <div className="mt-8">
        <Link href="/" className={buttonClass("primary")}>
          Go to Kudi
        </Link>
      </div>
    </main>
  );
}
