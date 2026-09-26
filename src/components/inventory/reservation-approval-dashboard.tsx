import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { usePendingReservations, useApproveReservation, useRejectReservation } from "@/hooks/useReservations";

/**
 * ReservationApprovalDashboard: Manager view for approving/rejecting reservations
 */

export function ReservationApprovalDashboard() {
  const { data: reservations = [], isLoading } = usePendingReservations();
  const { mutate: approve, isPending: isApproving } = useApproveReservation();
  const { mutate: reject, isPending: isRejecting } = useRejectReservation();

  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleApprove = (reservationId: string) => {
    approve(reservationId, {
      onSuccess: () => {
        toast.success("Reservation approved");
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to approve");
      },
    });
  };

  const handleReject = (reservationId: string) => {
    const reason = rejectionReasons[reservationId];
    if (!reason?.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    reject(
      { reservationId, rejectionReason: reason },
      {
        onSuccess: () => {
          toast.success("Reservation rejected");
          setRejectionReasons((prev) => {
            const next = { ...prev };
            delete next[reservationId];
            return next;
          });
          setExpandedId(null);
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to reject");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading reservations...
        </CardContent>
      </Card>
    );
  }

  if (reservations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-8 text-green-600" />
          <div className="text-lg font-semibold">No Pending Reservations</div>
          <div className="text-sm text-muted-foreground">All reservations have been reviewed</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pending Reservations ({reservations.length})</span>
          <Badge variant="outline">{reservations.length} Waiting</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="h-8">Requested By</TableHead>
                <TableHead className="h-8">Item Code</TableHead>
                <TableHead className="h-8">Item Name</TableHead>
                <TableHead className="h-8 text-right">Quantity</TableHead>
                <TableHead className="h-8">Reference</TableHead>
                <TableHead className="h-8">Expires</TableHead>
                <TableHead className="h-8 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((res) => (
                <div key={res.id}>
                  <TableRow className="hover:bg-muted/40">
                    <TableCell className="py-3 text-[0.6875rem]">
                      {res.reserved_by}
                    </TableCell>
                    <TableCell className="py-3 font-mono font-semibold text-primary">
                      {res.item_code || "-"}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="font-medium text-sm">{res.item_name || "-"}</div>
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono font-semibold">
                      {res.qty_reserved} {res.unit}
                    </TableCell>
                    <TableCell className="py-3 font-mono text-[0.625rem]">
                      {res.reference_doc || "-"}
                    </TableCell>
                    <TableCell className="py-3 text-[0.6875rem]">
                      {res.expires_at ? (
                        <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDistanceToNow(new Date(res.expires_at), {
                            addSuffix: true,
                          })}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setExpandedId(expandedId === res.id ? null : res.id)
                        }
                        className="h-7 text-xs"
                      >
                        {expandedId === res.id ? "Hide" : "Review"}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded row for approval actions */}
                  {expandedId === res.id && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={7} className="py-4">
                        <div className="space-y-4">
                          {/* Reservation details */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">Requested By</div>
                              <div className="font-medium">{res.reserved_by}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Date</div>
                              <div className="font-medium">
                                {new Date(res.reservation_date).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Quantity</div>
                              <div className="font-semibold">
                                {res.qty_reserved} {res.unit}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Reference</div>
                              <div className="font-mono text-xs">
                                {res.reference_doc || "-"}
                              </div>
                            </div>
                          </div>

                          {/* Remarks */}
                          {res.remarks && (
                            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                              <AlertCircle className="size-4 text-blue-600 dark:text-blue-400" />
                              <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                                <div className="font-semibold mb-1">Remarks:</div>
                                {res.remarks}
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Rejection reason input */}
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground">
                              Rejection Reason (if rejecting)
                            </label>
                            <Textarea
                              placeholder="Why are you rejecting this reservation?"
                              value={rejectionReasons[res.id] || ""}
                              onChange={(e) =>
                                setRejectionReasons((prev) => ({
                                  ...prev,
                                  [res.id]: e.target.value,
                                }))
                              }
                              maxLength={500}
                              className="text-sm resize-none h-20"
                            />
                            <p className="text-xs text-muted-foreground">
                              {(rejectionReasons[res.id] || "").length}/500
                            </p>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedId(null)}
                              disabled={isApproving || isRejecting}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(res.id)}
                              disabled={
                                isRejecting ||
                                !rejectionReasons[res.id]?.trim()
                              }
                              className="gap-2"
                            >
                              <XCircle className="size-4" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(res.id)}
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
