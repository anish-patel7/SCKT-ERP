import {
  useProductionOrderStatus,
  useProductionCosts,
  useFulfillmentDelay,
  useQualityInspections,
  useDefectAnalysis,
  useCostingAnalysis,
} from '@/hooks/useSalesIntegration';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Zap, Package, TrendingUp } from 'lucide-react';

interface OrderDetailIntegratedProps {
  salesOrderId: string;
}

export function OrderDetailIntegrated({ salesOrderId }: OrderDetailIntegratedProps) {
  const { data: prodOrder, isLoading: prodLoading } = useProductionOrderStatus(salesOrderId);
  const { data: prodCosts, isLoading: costsLoading } = useProductionCosts(salesOrderId);
  const { data: delay, isLoading: delayLoading } = useFulfillmentDelay(salesOrderId);
  const { data: inspections, isLoading: inspLoading } = useQualityInspections(salesOrderId);
  const { data: defectAnalysis, isLoading: defectLoading } = useDefectAnalysis(salesOrderId);
  const { data: costingAnalysis, isLoading: costingLoading } = useCostingAnalysis(salesOrderId);

  const isLoading =
    prodLoading ||
    costsLoading ||
    delayLoading ||
    inspLoading ||
    defectLoading ||
    costingLoading;

  if (isLoading) {
    return <div className="text-center py-8">Loading integrated order data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Order Details & Integrations</h2>
        <p className="text-muted-foreground">Production, inventory, quality, and costing insights</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="costing">Costing</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Production Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    prodOrder?.status === 'COMPLETED'
                      ? 'default'
                      : prodOrder?.status === 'DELAYED'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {prodOrder?.status || 'N/A'}
                </Badge>
                {delay && delay > 0 && (
                  <p className="text-xs text-red-600 mt-2">⚠️ {delay} days delayed</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Cost Variance</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${prodCosts && prodCosts.variance_pct > 0 ? 'text-red-600' : 'text-green-600'}`}
                >
                  {prodCosts?.variance_pct || 0}%
                </div>
                <p className="text-xs text-muted-foreground">vs. estimated</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quality Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={inspections && inspections.length > 0 ? 'default' : 'outline'}>
                  {inspections?.length || 0} inspections
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {costingAnalysis?.gross_margin_pct || 0}%
                </div>
                <p className="text-xs text-muted-foreground">Profitability</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Production Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {prodOrder && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Scheduled Start</p>
                    <p className="font-semibold">
                      {new Date(prodOrder.scheduled_start).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scheduled End</p>
                    <p className="font-semibold">
                      {new Date(prodOrder.scheduled_end).toLocaleDateString()}
                    </p>
                  </div>
                  {prodOrder.actual_start && (
                    <div>
                      <p className="text-sm text-muted-foreground">Actual Start</p>
                      <p className="font-semibold">
                        {new Date(prodOrder.actual_start).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {prodOrder.actual_end && (
                    <div>
                      <p className="text-sm text-muted-foreground">Actual End</p>
                      <p className="font-semibold">
                        {new Date(prodOrder.actual_end).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production Costs</CardTitle>
            </CardHeader>
            <CardContent>
              {prodCosts && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Material Cost:</span>
                    <span className="font-semibold">
                      ₹{prodCosts.material_cost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Labor Cost:</span>
                    <span className="font-semibold">
                      ₹{prodCosts.labor_cost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overhead Cost:</span>
                    <span className="font-semibold">
                      ₹{prodCosts.overhead_cost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span>Total Actual Cost:</span>
                    <span className="font-bold">
                      ₹{prodCosts.total_actual_cost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Estimated Cost:</span>
                    <span>₹{prodCosts.estimated_cost.toLocaleString('en-IN')}</span>
                  </div>
                  <div
                    className={`flex justify-between font-semibold ${prodCosts.variance_pct > 0 ? 'text-red-600' : 'text-green-600'}`}
                  >
                    <span>Variance:</span>
                    <span>{prodCosts.variance_pct}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality" className="space-y-4">
          {defectAnalysis && (
            <Card
              className={
                defectAnalysis.defect_rate_pct > 5
                  ? 'border-red-200 bg-red-50'
                  : 'border-green-200 bg-green-50'
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Defect Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Defects</p>
                    <p className="text-2xl font-bold">{defectAnalysis.total_defects}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Defect Rate</p>
                    <p
                      className={`text-2xl font-bold ${defectAnalysis.defect_rate_pct > 5 ? 'text-red-600' : 'text-green-600'}`}
                    >
                      {defectAnalysis.defect_rate_pct}%
                    </p>
                  </div>
                </div>

                {defectAnalysis.by_type.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Defects by Type:</p>
                    {defectAnalysis.by_type.map((d) => (
                      <div key={d.type} className="flex justify-between text-sm">
                        <span>{d.type}:</span>
                        <Badge variant="outline">{d.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {defectAnalysis.impact_on_credit > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm text-muted-foreground">Credit Impact</p>
                    <p className="text-lg font-bold text-red-600">
                      -₹{defectAnalysis.impact_on_credit.toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {inspections && inspections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Quality Inspections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inspections.map((inspection) => (
                    <div key={inspection.id} className="border rounded p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-sm">{inspection.status}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(inspection.inspection_date).toLocaleDateString()} by{' '}
                            {inspection.inspector}
                          </p>
                        </div>
                        <Badge>{inspection.defect_count} defects</Badge>
                      </div>
                      {inspection.defect_details && (
                        <p className="text-xs mt-2 text-muted-foreground">
                          {inspection.defect_details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Costing Tab */}
        <TabsContent value="costing" className="space-y-4">
          {costingAnalysis && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Cost Breakdown & Profitability
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Selling Price:</span>
                      <span className="font-semibold">
                        ₹{costingAnalysis.selling_price.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Material Cost:</span>
                      <span>₹{costingAnalysis.material_cost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Labor Cost:</span>
                      <span>₹{costingAnalysis.labor_cost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overhead Cost:</span>
                      <span>₹{costingAnalysis.overhead_cost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between font-semibold">
                      <span>Total Cost:</span>
                      <span>₹{costingAnalysis.total_cost.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="bg-gray-100 p-4 rounded space-y-2">
                    <div className="flex justify-between">
                      <span>Gross Margin:</span>
                      <span className="font-semibold text-green-600">
                        ₹{costingAnalysis.gross_margin.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gross Margin %:</span>
                      <span className="font-bold text-green-600">
                        {costingAnalysis.gross_margin_pct}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Net Margin %:</span>
                      <span className="font-bold text-blue-600">
                        {costingAnalysis.net_margin_pct}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
