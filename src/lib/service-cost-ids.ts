import type { BillLineItemResponse, ServiceCostResponse } from "./types";

// Recovers price-list entries' numeric ids from charges already made.
//
// `AutomaticBillLineItemRequest.serviceCostId` is numeric, but
// `ServiceCostResponse` carries only `publicId` (API-GAPS §1a). The one place
// the numeric id surfaces is on a line item charged from that price, which
// names the service by value rather than by `publicId` — so the two are
// joined on everything they share: name, category, cycle and currency.
//
// Two prices can agree on all four (say, the same fee at two class levels).
// The line item's `unitCost` then breaks the tie against `amount`; if it
// still can't, the entry is left out rather than guessed. A price no bill has
// been charged from yet is never in the map — the caller still asks for it.
export function serviceCostIdsFromLineItems(
  costs: ServiceCostResponse[],
  items: BillLineItemResponse[],
): Map<string, number> {
  const key = (
    name: string,
    category: string,
    cycle: string,
    currency: string,
  ) => [name.trim().toLowerCase(), category, cycle, currency].join("|");

  // Every distinct id seen under each key, with the unit costs it was charged at.
  const seen = new Map<string, Map<number, Set<number>>>();
  for (const item of items) {
    if (typeof item.serviceCostId !== "number") continue;
    const k = key(
      item.serviceName ?? "",
      item.serviceCategory,
      item.billingCycle,
      item.currency,
    );
    const ids = seen.get(k) ?? new Map<number, Set<number>>();
    const prices = ids.get(item.serviceCostId) ?? new Set<number>();
    prices.add(item.unitCost);
    ids.set(item.serviceCostId, prices);
    seen.set(k, ids);
  }

  const byPublicId = new Map<string, number>();
  for (const cost of costs) {
    const k = key(
      cost.serviceCostName,
      cost.serviceCategory,
      cost.billingCycle,
      cost.currency,
    );
    const ids = seen.get(k);
    if (!ids) continue;
    // Prices sharing this key are told apart by amount, so an id only counts
    // as this price's if it's unique once both sides are narrowed by amount.
    const siblings = costs.filter(
      (c) =>
        key(c.serviceCostName, c.serviceCategory, c.billingCycle, c.currency) ===
        k,
    );
    let candidates = [...ids.keys()];
    if (siblings.length > 1 || candidates.length > 1) {
      candidates = candidates.filter((id) => ids.get(id)!.has(cost.amount));
      const sameAmount = siblings.filter((c) => c.amount === cost.amount);
      if (sameAmount.length > 1) continue;
    }
    if (candidates.length === 1) byPublicId.set(cost.publicId, candidates[0]);
  }
  return byPublicId;
}
