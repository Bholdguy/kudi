import { NETWORKS, type NetworkKey } from "@/lib/chains";

/** Shows which network an invoice settles on, so no client mixes up Arc and Monad. */
export default function NetworkBadge({ network }: { network: NetworkKey }) {
  const isArc = network === "arc";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
        isArc ? "bg-coin/30 text-brand-deep" : "bg-brand-soft text-brand"
      }`}
      data-testid="network-badge"
      data-network={network}
    >
      <span
        className={`h-2 w-2 rounded-full ${isArc ? "bg-coin" : "bg-brand"}`}
        aria-hidden="true"
      />
      {NETWORKS[network].label}
    </span>
  );
}
