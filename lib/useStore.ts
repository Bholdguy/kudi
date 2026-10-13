"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSignedInSnapshot,
  getServerStateSnapshot,
  getSignedInSnapshot,
  getStateSnapshot,
  subscribe,
  type StoredState,
} from "@/lib/store";

const noopSubscribe = () => () => {};

export function useStoredState(): StoredState | null {
  return useSyncExternalStore(subscribe, getStateSnapshot, getServerStateSnapshot);
}

export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, getSignedInSnapshot, getServerSignedInSnapshot);
}

/** False during server render and hydration, true once the browser has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
