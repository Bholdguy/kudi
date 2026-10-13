import { Suspense } from "react";
import PayView from "@/components/PayView";

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-zinc-700">Loading...</p>
        </main>
      }
    >
      <PayView />
    </Suspense>
  );
}
