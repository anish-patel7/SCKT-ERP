import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useCreateReportTemplate, useValidateReportConfiguration } from '@/hooks/useCustomReports';
import { toast } from 'sonner';

const AVAILABLE_COLUMNS = {
  sales_orders: [
    { field: 'order_no', label: 'Order #', type: 'text' },
    { field: 'status', label: 'Status', type: 'select' },
    { field: 'customer_id', label: 'Customer', type: 'text' },
    { field: 'total_amount', label: 'Amount', type: 'number' },
    { field: 'created_at', label: 'Date', type: 'date' },
  ],
  sales_invoices: [
    { field: 'invoice_no', label: 'Invoice #', type: 'text' },
    { field: 'total_amount', label: 'Total', type: 'number' },
    { field: 'amount_paid', label: 'Paid', type: 'number' },
    { field: 'amount_outstanding', label: 'Outstanding', type: 'number' },
    { field: 'status', label: 'Status', type: 'select' },
  ],
};

interface ReportBuilderProps {
  onSuccess?: (templateId: string) => void;
}

export function ReportBuilder({ onSuccess }: ReportBuilderProps) {
  const [name, setName] = useState('');
  const [table, setTable] = useState<'sales_orders' | 'sales_invoices'>('sales_orders');
  const [columns, setColumns] = useState<any[]>(
    AVAILABLE_COLUMNS.sales_orders.slice(0, 3).map((col) => ({ ...col, visible: true }))
  );
  const [filters, setFilters] = useState<any[]>([]);
  const [aggregations, setAggregations] = useState<any[]>([]);

  const createMutation = useCreateReportTemplate();
  const validateMutation = useValidateReportConfiguration();

  const handleAddColumn = () => {
    const available = (AVAILABLE_COLUMNS[table] as any[]).filter(
      (col) => !columns.find((c) => c.field === col.field)
    );
    if (available.length > 0) {
      setColumns([...columns, { ...available[0], visible: true }]);
    }
  };

  const handleRemoveColumn = (field: string) => {
    setColumns(columns.filter((c) => c.field !== field));
  };

  const handleToggleColumnVisibility = (field: string) => {
    setColumns(
      columns.map((c) => (c.field === field ? { ...c, visible: !c.visible } : c))
    );
  };

  const handleAddAggregation = () => {
    const field = columns[0]?.field || 'total_amount';
    setAggregations([
      ...aggregations,
      { field, type: 'SUM', label: `${field} Total` },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Report name is required');
      return;
    }

    if (columns.length === 0) {
      toast.error('At least one column must be selected');
      return;
    }

    const config = {
      name,
      table,
      columns,
      filters,
      aggregations,
      description: '',
      scheduled: false,
    };

    // Validate configuration
    const validation = await validateMutation.mutateAsync(config);
    if (!validation.valid) {
      toast.error(`Configuration error: ${validation.errors?.join(', ')}`);
      return;
    }

    // Create template
    createMutation.mutate(config, {
      onSuccess: (templateId) => {
        toast.success('Report template created successfully');
        onSuccess?.(templateId);
      },
      onError: (error: any) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Tabs defaultValue="columns" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="columns">Columns</TabsTrigger>
        <TabsTrigger value="filters">Filters</TabsTrigger>
        <TabsTrigger value="aggregations">Aggregations</TabsTrigger>
      </TabsList>

      <TabsContent value="columns" className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Report Name</label>
          <Input
            placeholder="e.g., Monthly Sales Summary"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Data Source</label>
          <select
            value={table}
            onChange={(e) => {
              setTable(e.target.value as any);
              setColumns(
                (AVAILABLE_COLUMNS as any)[e.target.value]
                  .slice(0, 3)
                  .map((col: any) => ({ ...col, visible: true }))
              );
            }}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="sales_orders">Sales Orders</option>
            <option value="sales_invoices">Sales Invoices</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Columns to Display</label>
            <Button size="sm" variant="outline" onClick={handleAddColumn}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          <div className="space-y-2">
            {columns.map((col) => (
              <div key={col.field} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => handleToggleColumnVisibility(col.field)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {col.visible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <div>
                    <p className="text-sm font-medium">{col.label}</p>
                    <p className="text-xs text-muted-foreground">{col.field}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveColumn(col.field)}
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="filters" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Report Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Filters: {filters.length} applied
            </p>
            <Button size="sm" variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-1" /> Add Filter
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="aggregations" className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Summary Aggregations</label>
            <Button size="sm" variant="outline" onClick={handleAddAggregation}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          {aggregations.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 border rounded-md text-center">
              No aggregations configured
            </p>
          ) : (
            <div className="space-y-2">
              {aggregations.map((agg, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="text-sm font-medium">{agg.label}</p>
                    <Badge variant="secondary" className="mt-1">
                      {agg.type}({agg.field})
                    </Badge>
                  </div>
                  <button
                    onClick={() =>
                      setAggregations(aggregations.filter((_, i) => i !== idx))
                    }
                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      <div className="flex gap-2 mt-6">
        <Button variant="outline" className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={createMutation.isPending} className="flex-1">
          {createMutation.isPending ? 'Creating...' : 'Create Report'}
        </Button>
      </div>
    </Tabs>
  );
}
