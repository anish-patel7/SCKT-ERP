import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Table, Loader2 } from 'lucide-react';
import { useExecuteReport, useExportReport } from '@/hooks/useCustomReports';
import { toast } from 'sonner';

interface ReportViewerProps {
  templateId: string;
  templateName: string;
}

export function ReportViewer({ templateId, templateName }: ReportViewerProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [viewType, setViewType] = useState<'table' | 'chart'>('table');

  const executeMutation = useExecuteReport(templateId);
  const exportMutation = useExportReport();

  const handleExecute = async () => {
    executeMutation.mutate(undefined, {
      onSuccess: (data) => {
        setReportData(data);
        toast.success(`Report executed in ${data.execution_time_ms}ms`);
      },
      onError: (error: any) => {
        toast.error(error.message);
      },
    });
  };

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!reportData) {
      toast.error('Please execute report first');
      return;
    }

    exportMutation.mutate({ reportData, format }, {
      onSuccess: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${templateName}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success(`Report exported as ${format.toUpperCase()}`);
      },
      onError: (error: any) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{templateName}</CardTitle>
            <Button onClick={handleExecute} disabled={executeMutation.isPending}>
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Run Report'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!reportData ? (
            <div className="text-center p-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Click "Run Report" to execute and view results</p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              {reportData.summary && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                    <p className="text-2xl font-bold">{reportData.summary.total_rows}</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Execution Time</p>
                    <p className="text-2xl font-bold">{reportData.execution_time_ms}ms</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Aggregations</p>
                    <p className="text-2xl font-bold">
                      {Object.keys(reportData.summary.aggregations || {}).length}
                    </p>
                  </div>
                </div>
              )}

              {/* Aggregation Summary */}
              {reportData.summary?.aggregations &&
                Object.keys(reportData.summary.aggregations).length > 0 && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-sm">Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(reportData.summary.aggregations).map(([label, value]: any) => (
                          <div key={label}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-lg font-semibold">
                              {typeof value === 'number' ? value.toLocaleString() : value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

              {/* Data Table */}
              {reportData.rows && reportData.rows.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b">
                      <tr>
                        {reportData.columns.map((col: any) => (
                          <th key={col.field} className="text-left p-3 font-medium">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.slice(0, 50).map((row: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          {reportData.columns.map((col: any) => (
                            <td key={col.field} className="p-3">
                              {typeof row[col.field] === 'number'
                                ? row[col.field].toLocaleString()
                                : row[col.field]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reportData.rows?.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Showing 50 of {reportData.rows.length} rows. Export to see all data.
                </p>
              )}

              {/* Export Buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('csv')}
                  disabled={exportMutation.isPending}
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('excel')}
                  disabled={exportMutation.isPending}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('pdf')}
                  disabled={exportMutation.isPending}
                >
                  <Download className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
