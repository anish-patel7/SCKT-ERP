import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type TransactionSearchResponse } from "@/services/search";
import { searchService } from "@/services/search";
import { fmt } from "@/lib/costing";

/**
 * TransactionSearchResultsTable: Display search results with pagination
 */

export interface SearchResultsTableProps {
  data: TransactionSearchResponse;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onExport?: () => void;
  isExporting?: boolean;
}

export function TransactionSearchResultsTable({
  data,
  isLoading = false,
  onPageChange,
  onExport,
  isExporting = false,
}: SearchResultsTableProps) {
  const getMovementTypeColor = (type: string): string => {
    if (type.startsWith("inward_")) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (type.startsWith("issue_") || type === "dispatch") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    if (type === "transfer") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (type === "quality_rejection") return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">
          Results ({data.total} found)
        </CardTitle>
        {onExport && (
          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            disabled={isExporting || data.results.length === 0}
            className="gap-2"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="h-8">Date</TableHead>
                <TableHead className="h-8">Type</TableHead>
                <TableHead className="h-8">Item Code</TableHead>
                <TableHead className="h-8">Item Name</TableHead>
                <TableHead className="h-8 text-right">Qty</TableHead>
                <TableHead className="h-8">Unit</TableHead>
                <TableHead className="h-8">Reference</TableHead>
                <TableHead className="h-8">User</TableHead>
                <TableHead className="h-8">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Loading results...
                  </TableCell>
                </TableRow>
              ) : data.results.length > 0 ? (
                data.results.map((result) => (
                  <TableRow key={result.id} className="hover:bg-muted/40">
                    <TableCell className="py-2 font-mono text-[0.6875rem]">
                      {new Date(result.transaction_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge
                        className={`text-[0.625rem] ${getMovementTypeColor(result.movement_type)}`}
                      >
                        {searchService.getMovementTypeLabel(result.movement_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 font-mono font-semibold text-primary">
                      {result.item_code}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="font-medium">{result.item_name}</div>
                      <div className="text-[0.6875rem] text-muted-foreground">
                        {result.item_type.toUpperCase()}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono font-semibold">
                      {fmt(result.qty_change, 2)}
                    </TableCell>
                    <TableCell className="py-2 text-center">{result.unit}</TableCell>
                    <TableCell className="py-2 font-mono text-[0.625rem]">
                      {result.reference_doc || "-"}
                    </TableCell>
                    <TableCell className="py-2 text-[0.6875rem]">
                      {result.created_by || "-"}
                    </TableCell>
                    <TableCell className="py-2 text-[0.6875rem] max-w-[200px] truncate">
                      {result.remarks || "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    No transactions found matching your criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data.total > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing {(data.page - 1) * data.pageSize + 1} to{" "}
              {Math.min(data.page * data.pageSize, data.total)} of {data.total}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(data.page - 1)}
                disabled={data.page === 1 || isLoading}
                className="gap-1"
              >
                <ChevronLeft className="size-3" /> Previous
              </Button>
              <div className="flex items-center px-3 text-xs font-semibold">
                Page {data.page}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(data.page + 1)}
                disabled={!data.hasMore || isLoading}
                className="gap-1"
              >
                Next <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
