import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
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
import { CheckCircle2, AlertCircle, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { usePendingQAInspections, useApprovalStats, useInspectionDetails } from "@/hooks/useApprovalWorkflow";
import { QAInspectionDialog } from "./qa-inspection-dialog";

/**
 * QADashboard: Quality Assurance team view for inspecting inbound receipts
 */

export function QADashboard() {
  const { data: pendingItems = [], isLoading } = usePendingQAInspections();
  const { data: stats } = useApprovalStats();
  const [openInspection, setOpenInspection] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const handleInspectClick = (item: any) => {
    setSelectedItem(item);
    setOpenInspection(true);
  };

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case "A":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "B":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "C":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading QA queue...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pending QA</span>
              <ClipboardCheck className="size-4 text-amber-600" />
            </div>
            <p className="mt-1 text-lg font-bold font-mono text-amber-600">
              {stats?.pending_qa || 0}
            </p>
            <span className="text-[0.6875rem] text-muted-foreground">Awaiting inspection</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pending Approval</span>
              <AlertCircle className="size-4 text-blue-600" />
            </div>
            <p className="mt-1 text-lg font-bold font-mono text-blue-600">
              {stats?.pending_approval || 0}
            </p>
            <span className="text-[0.6875rem] text-muted-foreground">Inspected, awaiting manager</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Approved Today</span>
              <CheckCircle2 className="size-4 text-green-600" />
            </div>
            <p className="mt-1 text-lg font-bold font-mono text-green-600">
              {stats?.approved_today || 0}
            </p>
            <span className="text-[0.6875rem] text-muted-foreground">Completed approvals</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Rejected Today</span>
              <AlertCircle className="size-4 text-red-600" />
            </div>
            <p className="mt-1 text-lg font-bold font-mono text-red-600">
              {stats?.rejected_today || 0}
            </p>
            <span className="text-[0.6875rem] text-muted-foreground">Items rejected</span>
          </CardContent>
        </Card>
      </div>

      {/* QA Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>QA Inspection Queue</span>
            <Badge variant="outline">{pendingItems.length} Items</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingItems.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-8 text-green-600" />
              <div className="text-lg font-semibold">Queue Clear</div>
              <div className="text-sm text-muted-foreground">All pending items inspected</div>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="h-8">Date</TableHead>
                    <TableHead className="h-8">Reference</TableHead>
                    <TableHead className="h-8">Item Code</TableHead>
                    <TableHead className="h-8">Item Name</TableHead>
                    <TableHead className="h-8 text-right">Qty</TableHead>
                    <TableHead className="h-8">Grade</TableHead>
                    <TableHead className="h-8 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/40">
                      <TableCell className="py-2 font-mono text-[0.6875rem]">
                        {new Date(item.transaction_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-[0.625rem]">
                        {item.reference_doc || "-"}
                      </TableCell>
                      <TableCell className="py-2 font-mono font-semibold text-primary">
                        {item.item_code || "-"}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium text-sm">{item.item_name || "-"}</div>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono font-semibold">
                        {item.qty_change} {item.unit}
                      </TableCell>
                      <TableCell className="py-2">
                        {item.quality_grade ? (
                          <Badge className={`text-[0.625rem] ${getGradeColor(item.quality_grade)}`}>
                            {item.quality_grade}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[0.625rem]">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button
                          size="sm"
                          variant={item.quality_grade ? "outline" : "default"}
                          onClick={() => handleInspectClick(item)}
                          className="h-6 text-[0.6875rem] gap-1 px-2"
                        >
                          <ClipboardCheck className="size-3" />
                          {item.quality_grade ? "Re-inspect" : "Inspect"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QA Inspection Dialog */}
      {selectedItem && (
        <QAInspectionDialog
          open={openInspection}
          onOpenChange={setOpenInspection}
          transactionId={selectedItem.id}
          itemCode={selectedItem.item_code || "Unknown"}
          itemName={selectedItem.item_name || "Unknown"}
          qtyReceived={selectedItem.qty_change}
          unit={selectedItem.unit}
          referenceDoc={selectedItem.reference_doc}
        />
      )}
    </div>
  );
}
