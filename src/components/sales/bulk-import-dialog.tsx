import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Upload, Loader2 } from 'lucide-react';
import { useBulkImportValidation, useBulkCreateOrders } from '@/hooks/useBulkOrders';
import Papa from 'papaparse';
import { toast } from 'sonner';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkImportDialog({ open, onOpenChange, onSuccess }: BulkImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');

  const validateMutation = useBulkImportValidation();
  const createMutation = useBulkCreateOrders();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        setCsvData(results.data);
        validateMutation.mutate(results.data);
      },
      error: (error: any) => {
        toast.error(`CSV parsing error: ${error.message}`);
      },
    });
  };

  const handleValidate = async () => {
    if (!validateMutation.data) return;

    if (validateMutation.data.error_rows > 0) {
      toast.error(
        `${validateMutation.data.error_rows} row(s) have errors. Please review and correct.`
      );
      return;
    }

    setStep('confirm');
  };

  const handleCreate = async () => {
    if (!validateMutation.data?.preview_data) return;

    // Transform preview data to include items if provided in CSV
    const ordersToCreate = validateMutation.data.preview_data.map((row: any, idx: number) => ({
      ...row,
      items: csvData[idx]?.items ? JSON.parse(csvData[idx].items) : [],
    }));

    createMutation.mutate(ordersToCreate as any, {
      onSuccess: (result) => {
        if (result.status === 'success') {
          toast.success(`Successfully created ${result.created_orders.length} orders`);
          onOpenChange(false);
          onSuccess?.();
        } else if (result.status === 'partial_success') {
          toast.warning(
            `Created ${result.created_orders.length} orders, ${result.failed_orders.length} failed`
          );
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(`Failed to create orders: ${result.failed_orders[0]?.reason}`);
        }
      },
      onError: (error: any) => {
        toast.error(`Import failed: ${error.message}`);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Orders</DialogTitle>
        </DialogHeader>

        <Tabs value={step} onValueChange={(v) => setStep(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="preview" disabled={validateMutation.isPending || !csvData.length}>
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="confirm"
              disabled={!validateMutation.data || validateMutation.data.error_rows > 0}
            >
              Confirm
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">Upload CSV File</p>
              <p className="text-xs text-muted-foreground mb-4">
                CSV must include: order_no, customer_id, status, total_amount
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <Button asChild variant="outline">
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Choose File
                </label>
              </Button>
              {fileName && <p className="text-sm text-green-600 mt-2">✓ {fileName}</p>}
            </div>

            {validateMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </div>
            )}

            {validateMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validateMutation.error?.message}</AlertDescription>
              </Alert>
            )}

            {validateMutation.data && (
              <div className="space-y-2 text-sm">
                <p>Total rows: {validateMutation.data.total_rows}</p>
                <p className="text-green-600">✓ Valid: {validateMutation.data.valid_rows}</p>
                {validateMutation.data.error_rows > 0 && (
                  <p className="text-red-600">✗ Errors: {validateMutation.data.error_rows}</p>
                )}
              </div>
            )}

            {validateMutation.data?.error_rows === 0 && (
              <Button onClick={handleValidate} className="w-full">
                Preview Data
              </Button>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {validateMutation.data?.errors && validateMutation.data.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {validateMutation.data.errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="text-xs">
                        Row {err.row_index + 1}: {err.message}
                      </div>
                    ))}
                    {validateMutation.data.errors.length > 5 && (
                      <div className="text-xs">
                        ... and {validateMutation.data.errors.length - 5} more errors
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {validateMutation.data?.preview_data && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Order #</th>
                      <th className="text-left p-2">Customer ID</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validateMutation.data.preview_data.slice(0, 10).map((row: any, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2">{row.order_no}</td>
                        <td className="p-2 text-xs">{row.customer_id}</td>
                        <td className="p-2">
                          <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">
                            {row.status}
                          </span>
                        </td>
                        <td className="text-right p-2">₹{row.total_amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Showing {Math.min(10, validateMutation.data?.preview_data.length || 0)} of{' '}
              {validateMutation.data?.valid_rows} valid rows
            </p>

            <Button onClick={() => setStep('confirm')} className="w-full">
              Proceed to Import
            </Button>
          </TabsContent>

          <TabsContent value="confirm" className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Ready to import {validateMutation.data?.valid_rows} orders.{' '}
                {validateMutation.data?.error_rows ? (
                  <span className="text-red-600">
                    {validateMutation.data.error_rows} rows will be skipped due to errors.
                  </span>
                ) : (
                  <span className="text-green-600">All rows are valid.</span>
                )}
              </AlertDescription>
            </Alert>

            {createMutation.isPending && (
              <div className="flex items-center justify-center gap-2 p-4 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating orders...
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('preview')} disabled={createMutation.isPending}>
                Back
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? 'Importing...' : 'Import Now'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
