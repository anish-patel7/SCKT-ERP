import { useCreditSummary } from '@/hooks/useCustomers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, TrendingUp } from 'lucide-react';

interface CreditSummaryProps {
  customerId: string;
}

export function CreditSummary({ customerId }: CreditSummaryProps) {
  const { data: summary, isLoading } = useCreditSummary(customerId);

  if (isLoading) {
    return <div className="text-center py-4">Loading credit summary...</div>;
  }

  if (!summary) {
    return <div className="text-center py-4">No credit data available</div>;
  }

  const utilizationPercent = (summary.current_credit_used / summary.credit_limit) * 100;
  const isNearLimit = utilizationPercent > 80;
  const exceedsLimit = utilizationPercent > 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Credit Limit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹{summary.credit_limit.toLocaleString('en-IN')}</div>
          <p className="text-xs text-muted-foreground">Total limit</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Credit Used</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${exceedsLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-green-600'}`}
          >
            ₹{summary.current_credit_used.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-muted-foreground">{utilizationPercent.toFixed(1)}% utilized</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Available Credit</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${summary.available_credit < 0 ? 'text-red-600' : 'text-blue-600'}`}
          >
            ₹{summary.available_credit.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-muted-foreground">Can order</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {exceedsLimit && (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-600">Limit Exceeded</p>
                <p className="text-xs text-muted-foreground">Cannot create orders</p>
              </div>
            </div>
          )}
          {!exceedsLimit && isNearLimit && (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-600">Near Limit</p>
                <p className="text-xs text-muted-foreground">Requires approval</p>
              </div>
            </div>
          )}
          {!exceedsLimit && !isNearLimit && (
            <div>
              <p className="font-semibold text-green-600">Healthy</p>
              <p className="text-xs text-muted-foreground">Can order freely</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
