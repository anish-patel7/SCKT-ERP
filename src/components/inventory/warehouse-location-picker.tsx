import { useState, useMemo } from "react";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useWarehouseLayout,
  useWarehouseLocation,
  useSearchLocations,
  useAvailableLocations,
} from "@/hooks/useWarehouse";
import { warehouseService } from "@/services/warehouse";

/**
 * WarehouseLocationPicker: Interactive warehouse map with location selection
 * - Visual map of warehouse zones
 * - Click-to-select locations
 * - Real-time capacity display
 * - Search/autocomplete for location codes
 */

export interface WarehouseLocationPickerProps {
  selectedCode?: string;
  onSelectLocation: (code: string, locationId: string) => void;
  showAvailableOnly?: boolean;
}

export function WarehouseLocationPicker({
  selectedCode,
  onSelectLocation,
  showAvailableOnly = false,
}: WarehouseLocationPickerProps) {
  const [searchInput, setSearchInput] = useState("");

  // Queries
  const { data: layout } = useWarehouseLayout();
  const { data: selectedLocation } = useWarehouseLocation(undefined);
  const { data: searchResults } = useSearchLocations(
    searchInput.length > 0 ? searchInput : undefined,
  );
  const { data: availableLocations } = useAvailableLocations(
    showAvailableOnly ? undefined : undefined,
  );

  // Filter locations for display
  const displayLocations = useMemo(() => {
    if (!layout) return [];

    let locs = layout.locations;

    if (showAvailableOnly && availableLocations) {
      const availableIds = new Set(availableLocations.map((l) => l.id));
      locs = locs.filter((l) => availableIds.has(l.id));
    }

    return locs;
  }, [layout, availableLocations, showAvailableOnly]);

  // Search results or all locations
  const locationsToShow = searchInput.length > 0 ? searchResults : displayLocations;

  if (!layout) {
    return <div className="text-center py-8 text-muted-foreground">Loading warehouse layout...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search location code (e.g., BIN-A-01)..."
          className="pl-9 text-sm"
        />
      </div>

      {/* Map + Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Warehouse Map */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Warehouse Layout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 p-4 overflow-auto max-h-[500px]">
                <svg
                  width={layout.bounds.width}
                  height={layout.bounds.height}
                  className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  viewBox={`0 0 ${layout.bounds.width} ${layout.bounds.height}`}
                >
                  {/* Draw zones as colored regions */}
                  {layout.zones.map((zone) => {
                    const zoneLocations = layout.locations.filter(
                      (loc) => loc.zone_id === zone.id,
                    );

                    if (zoneLocations.length === 0) return null;

                    const minX = Math.min(...zoneLocations.map((l) => l.coordinates.x));
                    const minY = Math.min(...zoneLocations.map((l) => l.coordinates.y));
                    const maxX = Math.max(...zoneLocations.map((l) => l.coordinates.x)) + 80;
                    const maxY = Math.max(...zoneLocations.map((l) => l.coordinates.y)) + 50;

                    return (
                      <g key={zone.id}>
                        {/* Zone background */}
                        <rect
                          x={minX - 20}
                          y={minY - 30}
                          width={maxX - minX + 40}
                          height={maxY - minY + 40}
                          fill={zone.color_code}
                          opacity={0.1}
                          stroke={zone.color_code}
                          strokeWidth={2}
                          strokeDasharray="5,5"
                        />
                        {/* Zone label */}
                        <text
                          x={minX - 10}
                          y={minY - 10}
                          className="text-xs font-semibold"
                          fill={zone.color_code}
                        >
                          {zone.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* Draw location markers */}
                  {displayLocations.map((location) => {
                    const capacity = location.capacity_kg || location.capacity_metres || 1;
                    const used = location.capacity_kg
                      ? location.current_qty_kg
                      : location.current_qty_metres;
                    const color = warehouseService.getCapacityColor(
                      used,
                      capacity,
                    );
                    const isSelected = location.code === selectedCode;

                    return (
                      <g
                        key={location.id}
                        onClick={() => onSelectLocation(location.code, location.id)}
                        className="cursor-pointer"
                      >
                        {/* Location circle */}
                        <circle
                          cx={location.coordinates.x}
                          cy={location.coordinates.y}
                          r={isSelected ? 18 : 15}
                          fill={color}
                          stroke={isSelected ? "#000" : "none"}
                          strokeWidth={2}
                          opacity={0.8}
                          className="transition-all hover:opacity-100"
                        />

                        {/* Location code label */}
                        <text
                          x={location.coordinates.x}
                          y={location.coordinates.y + 25}
                          textAnchor="middle"
                          className="text-xs font-semibold"
                          fill="currentColor"
                        >
                          {location.code}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Location Details Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-0">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="size-4" /> Location Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCode ? (
                (() => {
                  const loc = displayLocations.find((l) => l.code === selectedCode);
                  if (!loc) {
                    return (
                      <div className="text-sm text-muted-foreground">
                        Location not found
                      </div>
                    );
                  }

                  const capacity = loc.capacity_kg || loc.capacity_metres || 0;
                  const used = loc.capacity_kg
                    ? loc.current_qty_kg
                    : loc.current_qty_metres;
                  const percent = capacity > 0 ? Math.round((used / capacity) * 100) : 0;
                  const unit = loc.capacity_kg ? "kg" : loc.capacity_metres ? "m" : "";

                  return (
                    <>
                      {/* Code & Name */}
                      <div>
                        <div className="text-xs text-muted-foreground">Code</div>
                        <div className="font-mono font-bold text-foreground">
                          {loc.code}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {loc.name}
                        </div>
                      </div>

                      {/* Zone */}
                      <div>
                        <div className="text-xs text-muted-foreground">Zone</div>
                        <Badge
                          style={{ backgroundColor: loc.zone?.color_code }}
                          className="text-white"
                        >
                          {loc.zone?.name}
                        </Badge>
                      </div>

                      {/* Capacity */}
                      {capacity > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Capacity
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="text-lg font-bold">
                              {used.toFixed(1)}/{capacity.toFixed(1)} {unit}
                            </div>
                            <Badge
                              variant={
                                percent >= 100
                                  ? "destructive"
                                  : percent >= 80
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {percent}%
                            </Badge>
                          </div>

                          {/* Capacity Bar */}
                          <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                percent >= 100
                                  ? "bg-red-500"
                                  : percent >= 80
                                    ? "bg-orange-500"
                                    : percent >= 50
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Status */}
                      <div className="text-xs text-muted-foreground border-t pt-3">
                        {percent >= 100
                          ? "🔴 Location is full"
                          : percent >= 80
                            ? "🟠 Location nearly full"
                            : "🟢 Location available"}
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Click a location on the map to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search Results List (if searching) */}
      {searchInput.length > 0 && searchResults && searchResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Search Results ({searchResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {searchResults.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    onSelectLocation(loc.code, loc.id);
                    setSearchInput("");
                  }}
                  className="w-full text-left p-2 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="font-mono font-semibold text-sm">
                    {loc.code}
                  </div>
                  <div className="text-xs text-muted-foreground">{loc.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Zone: {loc.zone?.name}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
