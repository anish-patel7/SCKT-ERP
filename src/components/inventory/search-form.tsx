import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSearchFormState,
  useDateRangePresets,
  useTransactionUsers,
} from "@/hooks/useSearch";
import { MOVEMENT_TYPES, ITEM_TYPES } from "@/services/search";

/**
 * TransactionSearchForm: Multi-dimensional search filter UI
 */

export interface SearchFormProps {
  onSearch: () => void;
  isLoading?: boolean;
}

export function TransactionSearchForm({
  onSearch,
  isLoading = false,
}: SearchFormProps) {
  const formState = useSearchFormState();
  const [presets] = useDateRangePresets();
  const { data: users = [] } = useTransactionUsers();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="size-5" /> Search Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range Section */}
        <div className="space-y-3">
          <div className="font-semibold text-sm">Date Range</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date_from" className="text-xs">
                From Date
              </Label>
              <Input
                id="date_from"
                type="date"
                value={formState.dateFrom}
                onChange={(e) => {
                  formState.setDateFrom(e.target.value);
                  formState.setPage(1);
                }}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="date_to" className="text-xs">
                To Date
              </Label>
              <Input
                id="date_to"
                type="date"
                value={formState.dateTo}
                onChange={(e) => {
                  formState.setDateTo(e.target.value);
                  formState.setPage(1);
                }}
                className="text-sm"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => formState.applyDatePreset(presets.today)}
              className="text-xs h-7"
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => formState.applyDatePreset(presets.this_week)}
              className="text-xs h-7"
            >
              This Week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => formState.applyDatePreset(presets.this_month)}
              className="text-xs h-7"
            >
              This Month
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => formState.applyDatePreset(presets.last_30_days)}
              className="text-xs h-7"
            >
              Last 30 Days
            </Button>
          </div>
        </div>

        {/* Movement Type Section */}
        <div className="space-y-3 border-t pt-4">
          <div className="font-semibold text-sm">Transaction Type</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MOVEMENT_TYPES.map((type) => (
              <div key={type.value} className="flex items-center gap-2">
                <Checkbox
                  id={`type_${type.value}`}
                  checked={formState.movementTypes.includes(type.value)}
                  onCheckedChange={() =>
                    formState.toggleMovementType(type.value)
                  }
                />
                <label
                  htmlFor={`type_${type.value}`}
                  className="text-sm cursor-pointer"
                >
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Item Type Section */}
        <div className="space-y-3 border-t pt-4">
          <div className="font-semibold text-sm">Item Type</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ITEM_TYPES.map((type) => (
              <div key={type.value} className="flex items-center gap-2">
                <Checkbox
                  id={`itemtype_${type.value}`}
                  checked={formState.itemTypes.includes(
                    type.value as "yarn" | "beam" | "fabric",
                  )}
                  onCheckedChange={() =>
                    formState.toggleItemType(
                      type.value as "yarn" | "beam" | "fabric",
                    )
                  }
                />
                <label
                  htmlFor={`itemtype_${type.value}`}
                  className="text-sm cursor-pointer"
                >
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Item Search Section */}
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="item_search" className="font-semibold text-sm">
            Item/Location Search
          </Label>
          <Input
            id="item_search"
            placeholder="Search by item code, name, or lot number..."
            value={formState.itemSearchQuery}
            onChange={(e) => {
              formState.setItemSearchQuery(e.target.value);
              formState.setPage(1);
            }}
            className="text-sm"
          />
        </div>

        {/* Reference Document Section */}
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="ref_doc" className="font-semibold text-sm">
            Reference Document
          </Label>
          <Input
            id="ref_doc"
            placeholder="Search by GRN, PO, SO, Job Card..."
            value={formState.referenceDocQuery}
            onChange={(e) => {
              formState.setReferenceDocQuery(e.target.value);
              formState.setPage(1);
            }}
            className="text-sm"
          />
        </div>

        {/* User/Department Section */}
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="created_by" className="font-semibold text-sm">
            Created By
          </Label>
          <Select
            value={formState.createdBy}
            onValueChange={(value) => {
              formState.setCreatedBy(value === "all" ? "" : value);
              formState.setPage(1);
            }}
          >
            <SelectTrigger id="created_by" className="text-sm">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user} value={user}>
                  {user}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 border-t pt-4">
          <Button
            onClick={onSearch}
            disabled={isLoading}
            className="flex-1"
          >
            <Search className="mr-2 size-4" /> Search
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={formState.resetFilters}
            className="flex-1"
          >
            <X className="mr-2 size-4" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
