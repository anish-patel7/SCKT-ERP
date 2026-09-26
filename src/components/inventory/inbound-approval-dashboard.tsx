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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { usePendingManagerApprovals, useApproveTransaction } from "@/hooks/useApprovalWorkflow";

/**
 * InboundApprovalDashboard: Manager view for approving/rejecting QA-inspected items
 */

export function InboundApprovalDashboard() {
  const { data: pendingItems = [], isLoading } = usePendingManagerApprovals();
  const { mutate: approve, isPending: isApproving } = useApproveTransaction();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [rejectionQtys, setRejectionQtys] = useState<Record<string, string>>({});

  const handleApprove = (itemId: string) => {
    approve(
      {
        transaction_id: itemId,
        approval_status: "APPROVED",
      },
      {
        onSuccess: () => {
          toast.success("Inbound receipt approved");
          setExpandedId(null);
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to approve");
        },
      },
    );
  };

  const handlePartialReject = (itemId: string, totalQty: number) => {
    const rejectionQty = parseFloat(rejectionQtys[itemId] || "0");
    if (!rejectionQty || rejectionQty <= 0 || rejectionQty >= totalQty) {
      toast.error("Rejection qty must be between 0 and " + totalQty);
      return;
    }

    const reason = rejectionReasons[itemId];
    if (!reason?.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    approve(
      {
        transaction_id: itemId,
        approval_status: "PARTIAL_REJECT",
        rejection_qty: rejectionQty,
        rejection_reason: reason,
      },
      {
        onSuccess: () => {
          toast.success(`Partial rejection recorded: ${rejectionQty} ${rejectionQtys[itemId]} units rejected`);
          setExpandedId(null);
          setRejectionReasons((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
          setRejectionQtys((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to reject");
        },
      },
    );
  };

  const handleReject = (itemId: string) => {
    const reason = rejectionReasons[itemId];
    if (!reason?.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    approve(
      {
        transaction_id: itemId,
        approval_status: "REJECTED",
        rejection_reason: reason,
      },
      {
        onSuccess: () => {
          toast.success("Inbound receipt rejected");
          setExpandedId(null);
          setRejectionReasons((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to reject");
        },
      },
    );
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
          Loading approval queue...
        </CardContent>
      </Card>
    );
  }

  if (pendingItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-8 text-green-600" />
          <div className="text-lg font-semibold">No Pending Approvals</div>
          <div className="text-sm text-muted-foreground">All QA-inspected items have been reviewed</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Inbound Receipt Approvals</span>
          <Badge variant="outline">{pendingItems.length} Pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                <TableHead className="h-8">Inspector</TableHead>
                <TableHead className="h-8 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingItems.map((item) => (
                <div key={item.id}>
                  <TableRow className="hover:bg-muted/40">
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
                      <Badge className={`text-[0.625rem] ${getGradeColor(item.quality_grade)}`}>
                        {item.quality_grade}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-[0.6875rem]">
                      {item.inspected_by || "-"}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="h-7 text-xs"
                      >
                        {expandedId === item.id ? "Hide" : "Review"}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded row for approval actions */}
                  {expandedId === item.id && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={8} className="py-4">
                        <div className="space-y-4">
                          {/* Inspection Details */}
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">Quality Grade</div>
                              <Badge className={`text-xs mt-1 ${getGradeColor(item.quality_grade)}`}>
                                {item.quality_grade}
                              </Badge>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Inspected By</div>
                              <div className="font-medium">{item.inspected_by || "-"}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Inspected At</div>
                              <div className="font-medium text-xs">
                                {item.inspected_at
                                  ? formatDistanceToNow(new Date(item.inspected_at), {
                                      addSuffix: true,
                                    })
                                  : "-"}
                              </div>
                            </div>
                          </div>

                          {/* Quality Remarks */}
                          {item.quality_remarks && (
                            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                              <AlertCircle className="size-4 text-blue-600 dark:text-blue-400" />
                              <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                                <div className="font-semibold mb-1">QA Remarks:</div>
                                {item.quality_remarks}
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Rejection Reason Input */}
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground">
                              Rejection/Comments Reason
                            </label>
                            <Textarea
                              placeholder="Why are you rejecting or commenting on this receipt?"
                              value={rejectionReasons[item.id] || ""}
                              onChange={(e) =>
                                setRejectionReasons((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              maxLength={500}
                              className="text-sm resize-none h-20"
                            />
                            <p className="text-xs text-muted-foreground">
                              {(rejectionReasons[item.id] || "").length}/500
                            </p>
                          </div>

                          {/* Partial Reject Qty */}
                          <div className="space-y-2">
                            <label htmlFor={`partial-${item.id}`} className="text-xs font-semibold text-muted-foreground">
                              Partial Rejection Qty (Leave empty for full receipt)
                            </label>
                            <div className="flex gap-2">
                              <Input
                                id={`partial-${item.id}`}
                                type="number"
                                step="0.01"
                                placeholder={`Max: ${item.qty_change}`}
                                value={rejectionQtys[item.id] || ""}
                                onChange={(e) =>
                                  setRejectionQtys((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                className="flex-1 text-sm"
                              />
                              <div className="flex items-center px-3 rounded-md bg-muted text-sm font-medium">
                                {item.unit}
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 justify-end flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedId(null)}
                              disabled={isApproving}
                            >
                              Cancel
                            </Button>

                            {rejectionQtys[item.id] && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handlePartialReject(item.id, item.qty_change)}
                                disabled={
                                  isApproving ||
                                  !rejectionReasons[item.id]?.trim() ||
                                  !rejectionQtys[item.id]
                                }
                                className="gap-2"
                              >
                                <AlertCircle className="size-4" />
                                Partial Reject
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(item.id)}
                              disabled={isApproving || !rejectionReasons[item.id]?.trim()}
                              className="gap-2"
                            >
                              <XCircle className="size-4" />
                              Reject
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleApprove(item.id)}
                              disabled={isApproving}
                              className="gap-2 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="size-4" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </div>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
