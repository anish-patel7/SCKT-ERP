import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, Zap } from 'lucide-react';
import { useBulkOperationHistory } from '@/hooks/useBulkOrders';
import { Skeleton } from '@/components/ui/skeleton';

interface OperationRowProps {
  operation: any;
}

function OperationRow({ operation }: OperationRowProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'partial_success':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'import':
        return 'Bulk Import';
      case 'status_update':
        return 'Status Update';
      case 'price_adjustment':
        return 'Price Adjustment';
      default:
        return type;
    }
  };

  const successRate =
    operation.total_records > 0
      ? Math.round((operation.processed_records / operation.total_records) * 100)
      : 0;

  return (
    <div className="flex items-center justify-between p-4 border-b hover:bg-muted/50">
      <div className="flex items-center gap-3 flex-1">
        {getStatusIcon(operation.status)}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{getTypeLabel(operation.operation_type)}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(operation.created_at), 'MMM d, yyyy HH:mm')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="text-right">
          <p className="font-medium">{operation.processed_records} success</p>
          {operation.error_records > 0 && (
            <p className="text-xs text-red-600">{operation.error_records} failed</p>
          )}
        </div>

        <div className="w-24">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all"
              style={{ width: `${successRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{successRate}%</p>
        </div>

        <Badge
          variant={
            operation.status === 'completed'
              ? 'outline'
              : operation.status === 'failed'
                ? 'destructive'
                : 'secondary'
          }
          className="whitespace-nowrap"
        >
          {operation.status}
        </Badge>
      </div>
    </div>
  );
}

export function BulkOperationsDashboard() {
  const { data: operations, isLoading } = useBulkOperationHistory(50);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!operations || operations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Zap className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No bulk operations yet</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary stats
  const totalOps = operations.length;
  const completedOps = operations.filter((o) => o.status === 'completed').length;
  const failedOps = operations.filter((o) => o.status === 'failed').length;
  const totalRecords = operations.reduce((sum, o) => sum + o.total_records, 0);
  const successRecords = operations.reduce((sum, o) => sum + o.processed_records, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalOps}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{completedOps}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{failedOps}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalRecords > 0
                ? Math.round((successRecords / totalRecords) * 100)
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Operations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {operations.slice(0, 20).map((operation) => (
              <OperationRow key={operation.id} operation={operation} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
