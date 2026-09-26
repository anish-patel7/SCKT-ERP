import { useFinanceDashboard } from '@/hooks/useRoleBasedAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

export function FinanceDashboard() {
  const { data, isLoading } = useFinanceDashboard();

  if (isLoading) {
    return <div className="text-center py-8">Loading finance dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Finance Dashboard</h2>
        <p className="text-muted-foreground">Revenue, margins, and cash flow analysis</p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(data?.revenue_summary.total_invoiced || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: ₹{(data?.revenue_summary.avg_invoice_value || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Amount Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{(data?.revenue_summary.total_paid || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">From invoiced amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ₹{(data?.revenue_summary.total_outstanding || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">Pending collection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Revenue Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 flex items-center gap-1">
              {data?.revenue_summary.revenue_growth_pct || 0}%
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">YoY growth</p>
          </CardContent>
        </Card>
      </div>

      {/* Margin Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Margin Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Gross Margin:</span>
                <Badge variant="outline">{data?.margin_analysis.gross_margin_pct || 0}%</Badge>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${data?.margin_analysis.gross_margin_pct || 0}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Net Margin:</span>
                <Badge variant="outline">{data?.margin_analysis.net_margin_pct || 0}%</Badge>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${data?.margin_analysis.net_margin_pct || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Credit Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Credit Limit:</span>
                <span className="font-semibold">
                  ₹{(data?.credit_utilization.total_credit_limit || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Outstanding:</span>
                <span className="font-semibold">
                  ₹{(data?.credit_utilization.total_outstanding || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Utilization:</span>
                <Badge
                  variant={
                    (data?.credit_utilization.utilization_pct || 0) > 75
                      ? 'destructive'
                      : 'default'
                  }
                >
                  {data?.credit_utilization.utilization_pct || 0}%
                </Badge>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    (data?.credit_utilization.utilization_pct || 0) > 75
                      ? 'bg-red-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${data?.credit_utilization.utilization_pct || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Projection */}
      <Card>
        <CardHeader>
          <CardTitle>30-Day Cash Flow Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Current Cash</p>
              <p className="text-lg font-bold">
                ₹{(data?.cash_flow.current_cash || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Expected Inflows (30d)</p>
              <p className="text-lg font-bold text-green-600">
                ₹{(data?.cash_flow.expected_inflows_30d || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Expected Outflows (30d)</p>
              <p className="text-lg font-bold text-red-600">
                ₹{(data?.cash_flow.expected_outflows_30d || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Projected Balance (30d)</p>
              <p className="text-lg font-bold text-blue-600">
                ₹{(data?.cash_flow.projected_balance_30d || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
