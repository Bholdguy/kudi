import { Suspense } from "react";
import { Logo } from "@/components/BrandMark";
import PayView from "@/components/PayView";
import { Skeleton } from "@/components/ui";

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh" aria-busy="true">
          <header className="mx-auto w-full max-w-lg px-5 pt-5">
            <Logo size={30} />
          </header>
          <main className="mx-auto w-full max-w-lg px-5 pt-8">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-3 h-10 w-56" />
            <Skeleton className="mt-8 h-14 w-60" />
            <span className="sr-only">Loading invoice</span>
          </main>
        </div>
      }
    >
      <PayView />
    </Suspense>
  );
}
