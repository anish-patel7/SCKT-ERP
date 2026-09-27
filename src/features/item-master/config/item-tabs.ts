/** The five Item Master configuration tabs, in screen order. */
export type ItemTabId = "basic" | "weft" | "warp" | "setup" | "status";

export const ITEM_TABS: { id: ItemTabId; label: string }[] = [
  { id: "basic", label: "Basic Configuration" },
  { id: "weft", label: "Weft Detail" },
  { id: "warp", label: "Warp Detail" },
  { id: "setup", label: "Setup Configuration" },
  { id: "status", label: "Status Configuration" },
];
