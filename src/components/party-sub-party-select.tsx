import { useEffect, useMemo } from "react";
import { useParties, useSubPartiesByPartyId } from "@/hooks/useParties";
import type { Database } from "@/integrations/supabase/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin } from "lucide-react";

type Party = Database["public"]["Tables"]["parties"]["Row"];
type SubParty = Database["public"]["Tables"]["party_sub_parties"]["Row"];
type PartyType = "Purchase Party" | "Sell Party" | "Job Party";

export interface PartySubPartySelectProps {
  partyType?: PartyType | undefined;
  selectedPartyId?: string | undefined;
  selectedSubPartyId?: string | undefined;
  onPartyChange: (partyId: string, partyRecord?: Party) => void;
  onSubPartyChange: (subPartyId: string, subPartyRecord?: SubParty) => void;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  partyLabel?: string | undefined;
  subPartyLabel?: string | undefined;
  className?: string | undefined;
}

export function PartySubPartySelect({
  partyType,
  selectedPartyId = "",
  selectedSubPartyId = "",
  onPartyChange,
  onSubPartyChange,
  disabled = false,
  required = false,
  partyLabel = "Select Party",
  subPartyLabel = "Select Sub Party",
  className = "grid grid-cols-2 gap-3",
}: PartySubPartySelectProps) {
  const { data: allParties = [] } = useParties();
  const { data: subPartiesForParty = [] } = useSubPartiesByPartyId(selectedPartyId, true);

  const parties = useMemo(() => {
    const active = allParties.filter((p) => p.status === "Active");
    // Note: party_type is on party_sub_parties, not parties table
    // Filtering by party_type should happen when selecting sub_parties
    return active;
  }, [allParties]);

  // Auto-select default sub-party when party changes
  useEffect(() => {
    if (!selectedPartyId) {
      if (selectedSubPartyId) {
        onSubPartyChange("", undefined);
      }
      return;
    }

    const existing = subPartiesForParty.find((sp) => sp.id === selectedSubPartyId);
    if (!existing) {
      const defaultSub = subPartiesForParty.find((sp) => sp.is_default) || subPartiesForParty[0];
      if (defaultSub) {
        onSubPartyChange(defaultSub.id, defaultSub);
      } else {
        onSubPartyChange("", undefined);
      }
    }
  }, [selectedPartyId, subPartiesForParty, selectedSubPartyId, onSubPartyChange]);

  const handlePartySelect = (partyId: string) => {
    const p = parties.find((item) => item.id === partyId);
    onPartyChange(partyId, p);
  };

  const handleSubPartySelect = (subPartyId: string) => {
    const sp = subPartiesForParty.find((item) => item.id === subPartyId);
    onSubPartyChange(subPartyId, sp);
  };

  return (
    <div className={className}>
      {/* Main Party Selection */}
      <div className="space-y-1">
        <Label className="text-xs font-medium flex items-center gap-1">
          <Building2 className="size-3 text-primary" />
          {partyLabel} {required && <span className="text-destructive">*</span>}
        </Label>
        <Select value={selectedPartyId} onValueChange={handlePartySelect} disabled={disabled}>
          <SelectTrigger className="h-8 text-xs font-semibold">
            <SelectValue placeholder={`Select ${partyType || "Party"}...`} />
          </SelectTrigger>
          <SelectContent>
            {parties.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                <div className="flex items-center justify-between gap-2 w-full">
                  <span>
                    <strong className="font-mono text-primary font-bold">{p.party_code}</strong> —{" "}
                    {p.party_name}
                  </span>
                  <span className="text-[0.625rem] text-muted-foreground">({p.city})</span>
                </div>
              </SelectItem>
            ))}
            {!parties.length && (
              <SelectItem value="none" disabled className="text-xs text-muted-foreground">
                No active parties found
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Sub Party Selection */}
      <div className="space-y-1">
        <Label className="text-xs font-medium flex items-center gap-1">
          <MapPin className="size-3 text-primary" />
          {subPartyLabel} {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={selectedSubPartyId}
          onValueChange={handleSubPartySelect}
          disabled={disabled || !selectedPartyId || !subPartiesForParty.length}
        >
          <SelectTrigger className="h-8 text-xs font-medium">
            <SelectValue
              placeholder={
                !selectedPartyId
                  ? "Select Party First"
                  : !subPartiesForParty.length
                    ? "No Sub Parties"
                    : "Select Sub Party..."
              }
            />
          </SelectTrigger>
          <SelectContent>
            {subPartiesForParty.map((sp) => (
              <SelectItem key={sp.id} value={sp.id} className="text-xs">
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="flex items-center gap-1.5">
                    <strong className="font-mono font-bold text-primary">
                      {sp.sub_party_code}
                    </strong>
                    <span>{sp.sub_party_name}</span>
                    {sp.is_default && (
                      <Badge
                        variant="outline"
                        className="text-[0.5625rem] h-4 py-0 bg-primary/10 text-primary border-primary/30"
                      >
                        Default
                      </Badge>
                    )}
                  </span>
                  <span className="text-[0.625rem] text-muted-foreground">
                    {sp.location_type} ({sp.city})
                  </span>
                </div>
              </SelectItem>
            ))}
            {!subPartiesForParty.length && selectedPartyId && (
              <SelectItem value="none" disabled className="text-xs text-muted-foreground">
                No active sub parties available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
