"use client";

import { useState } from "react";

type CopyState = "idle" | "copied" | "failed";

export default function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className: string;
}) {
  const [state, setState] = useState<CopyState>("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {state === "copied" ? "Copied" : state === "failed" ? "Could not copy. Try again." : label}
    </button>
  );
}
