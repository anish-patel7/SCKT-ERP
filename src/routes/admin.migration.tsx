import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, CheckCircle, Info, Upload, Download, Play } from "lucide-react";
import { requireAuth } from "@/lib/route-guards";
import { Can } from "@/components/auth";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocalStorageData, useFullMigration, useExportLocalStorage, useMigrationValidator } from "@/hooks/useMigration";
import { fmt } from "@/lib/costing";

export const Route = createFileRoute("/admin/migration")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: AdminMigrationPage,
});

function AdminMigrationPage() {
  const [confirmMigration, setConfirmMigration] = useState(false);
  const { data: storageData, isLoading: isLoadingStorage } = useLocalStorageData();
  const { data: validationResult, isLoading: isValidating } = useMigrationValidator();
  const { migrate, isPending: isMigrating, data: migrationResult, progress } = useFullMigration();
  const { mutate: exportData, isPending: isExporting } = useExportLocalStorage();

  const handleStartMigration = async () => {
    if (!storageData) return;

    migrate({
      costSheets: storageData.costSheets,
      yarnMasters: storageData.yarnMasters,
      inventory: storageData.inventory,
    });
  };

  const totalStorageRecords =
    (storageData?.costSheets.length || 0) +
    (storageData?.yarnMasters.length || 0) +
    (storageData?.inventory.yarn.length || 0) +
    (storageData?.inventory.beams.length || 0) +
    (storageData?.inventory.fabricRolls.length || 0) +
    (storageData?.inventory.movements.length || 0);

  const validationPassed =
    validationResult &&
    validationResult.costSheets.valid &&
    validationResult.yarnMasters.valid &&
    validationResult.inventory.valid;

  return (
    <AppShell
      title="Data Migration — Admin Console"
      breadcrumb={[{ label: "System" }, { label: "Data Migration" }]}
    >
      <Can permission="user_management:write">
        <div className="space-y-6">
          {/* Overview Alert */}
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              This tool migrates historical data from browser localStorage to PostgreSQL. After migration,
              all users will see production data with full audit trails and role-based access control.
            </AlertDescription>
          </Alert>

          {/* Data Summary */}
          {isLoadingStorage ? (
            <div className="text-center text-muted-foreground">Loading localStorage data...</div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">localStorage Data Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1 rounded border border-border bg-muted/30 p-3">
                    <div className="text-xs font-semibold text-muted-foreground">Cost Sheets</div>
                    <div className="text-2xl font-bold text-foreground">
                      {storageData?.costSheets.length || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      +{storageData?.costSheets.reduce((sum, cs) => sum + cs.lines.length + cs.charges.length, 0) || 0} lines/charges
                    </div>
                  </div>

                  <div className="space-y-1 rounded border border-border bg-muted/30 p-3">
                    <div className="text-xs font-semibold text-muted-foreground">Yarn Materials</div>
                    <div className="text-2xl font-bold text-foreground">
                      {storageData?.yarnMasters.length || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">All active</div>
                  </div>

                  <div className="space-y-1 rounded border border-border bg-muted/30 p-3">
                    <div className="text-xs font-semibold text-muted-foreground">Inventory Items</div>
                    <div className="text-2xl font-bold text-foreground">
                      {(storageData?.inventory.yarn.length || 0) +
                        (storageData?.inventory.beams.length || 0) +
                        (storageData?.inventory.fabricRolls.length || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      +{storageData?.inventory.movements.length || 0} movements
                    </div>
                  </div>

                  <div className="space-y-1 rounded border border-border bg-muted/30 p-3">
                    <div className="text-xs font-semibold text-muted-foreground">Yarn Items</div>
                    <div className="text-2xl font-bold text-foreground">
                      {storageData?.inventory.yarn.length || 0}
                    </div>
                  </div>

                  <div className="space-y-1 rounded border border-border bg-muted/30 p-3">
                    <div className="text-xs font-semibold text-muted-foreground">Beam Items</div>
                    <div className="text-2xl font-bold text-foreground">
                      {storageData?.inventory.beams.length || 0}
                    </div>
                  </div>

                  <div className="space-y-1 rounded border border-border bg-muted/30 p-3">
                    <div className="text-xs font-semibold text-muted-foreground">Fabric Items</div>
                    <div className="text-2xl font-bold text-foreground">
                      {storageData?.inventory.fabricRolls.length || 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Results */}
          {isValidating ? (
            <div className="text-center text-muted-foreground">Validating data...</div>
          ) : validationResult ? (
            <Tabs defaultValue="validation" className="w-full">
              <TabsList className="h-8 text-xs">
                <TabsTrigger value="validation" className="h-7 text-xs gap-1">
                  {validationPassed ? (
                    <>
                      <CheckCircle className="size-3.5 text-emerald-600" /> Validation
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3.5 text-red-600" /> Validation
                    </>
                  )}
                </TabsTrigger>
                {migrationResult && (
                  <TabsTrigger value="results" className="h-7 text-xs gap-1">
                    <CheckCircle className="size-3.5 text-emerald-600" /> Results
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Validation Tab */}
              <TabsContent value="validation" className="space-y-3 mt-3">
                <div className="space-y-3">
                  {/* Cost Sheets Validation */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Cost Sheets</CardTitle>
                        {validationResult.costSheets.valid ? (
                          <Badge variant="default" className="bg-emerald-600">
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Invalid</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-semibold">{validationResult.costSheets.summary.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid:</span>
                        <span className="font-semibold text-emerald-600">
                          {validationResult.costSheets.summary.valid}
                        </span>
                      </div>
                      {validationResult.costSheets.summary.warnings > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Warnings:</span>
                          <span className="font-semibold text-amber-600">
                            {validationResult.costSheets.summary.warnings}
                          </span>
                        </div>
                      )}
                      {validationResult.costSheets.errors.length > 0 && (
                        <div className="mt-2 text-red-600 text-xs">
                          <p className="font-semibold">Errors:</p>
                          {validationResult.costSheets.errors.slice(0, 3).map((err, i) => (
                            <p key={i}>
                              {err.record}: {err.message}
                            </p>
                          ))}
                          {validationResult.costSheets.errors.length > 3 && (
                            <p>+{validationResult.costSheets.errors.length - 3} more</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Yarn Masters Validation */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Yarn Masters</CardTitle>
                        {validationResult.yarnMasters.valid ? (
                          <Badge variant="default" className="bg-emerald-600">
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Invalid</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-semibold">{validationResult.yarnMasters.summary.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid:</span>
                        <span className="font-semibold text-emerald-600">
                          {validationResult.yarnMasters.summary.valid}
                        </span>
                      </div>
                      {validationResult.yarnMasters.summary.warnings > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Warnings:</span>
                          <span className="font-semibold text-amber-600">
                            {validationResult.yarnMasters.summary.warnings}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Inventory Validation */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Inventory</CardTitle>
                        {validationResult.inventory.valid ? (
                          <Badge variant="default" className="bg-emerald-600">
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Invalid</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total items:</span>
                        <span className="font-semibold">
                          {validationResult.inventory.summary.total -
                            (storageData?.inventory.movements.length || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total movements:</span>
                        <span className="font-semibold">{storageData?.inventory.movements.length || 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3">
                  <Button
                    onClick={() => exportData()}
                    disabled={isExporting}
                    variant="outline"
                    className="gap-2"
                  >
                    <Download className="size-4" />
                    Export Data
                  </Button>

                  <Button
                    onClick={() => setConfirmMigration(true)}
                    disabled={!validationPassed || isMigrating}
                    className="gap-2 flex-1"
                  >
                    <Play className="size-4" />
                    Start Migration
                  </Button>
                </div>

                {/* Confirmation Dialog */}
                {confirmMigration && validationPassed && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm text-amber-900">
                      <p className="font-semibold mb-2">Ready to migrate?</p>
                      <p className="mb-3">
                        This will import {fmt(totalStorageRecords, 0)} records to PostgreSQL. This operation cannot
                        be undone once started.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleStartMigration}
                          disabled={isMigrating}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7"
                        >
                          {isMigrating ? "Migrating..." : "Confirm & Start"}
                        </Button>
                        <Button
                          onClick={() => setConfirmMigration(false)}
                          variant="outline"
                          className="text-xs h-7"
                        >
                          Cancel
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Progress */}
                {isMigrating && progress && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="inline-block size-2 rounded-full bg-blue-600 animate-pulse" />
                        Migration in Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{progress.message}</span>
                          <span className="text-muted-foreground">
                            {progress.processed} / {progress.total}
                          </span>
                        </div>
                        <Progress value={(progress.processed / progress.total) * 100} className="h-2" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="space-y-1 rounded border border-border bg-muted/30 p-2">
                          <div className="text-muted-foreground">Imported</div>
                          <div className="text-lg font-bold text-emerald-600">
                            {progress.successCount}
                          </div>
                        </div>
                        <div className="space-y-1 rounded border border-border bg-muted/30 p-2">
                          <div className="text-muted-foreground">Errors</div>
                          <div className="text-lg font-bold text-red-600">
                            {progress.errorCount}
                          </div>
                        </div>
                        <div className="space-y-1 rounded border border-border bg-muted/30 p-2">
                          <div className="text-muted-foreground">Warnings</div>
                          <div className="text-lg font-bold text-amber-600">
                            {progress.warningCount}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Results Tab */}
              {migrationResult && (
                <TabsContent value="results" className="space-y-3 mt-3">
                  <Alert
                    className={
                      migrationResult.success
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-red-50"
                    }
                  >
                    <CheckCircle
                      className={`h-4 w-4 ${
                        migrationResult.success ? "text-emerald-600" : "text-red-600"
                      }`}
                    />
                    <AlertDescription
                      className={`text-sm ${
                        migrationResult.success ? "text-emerald-900" : "text-red-900"
                      }`}
                    >
                      {migrationResult.success
                        ? "Migration completed successfully!"
                        : "Migration completed with errors. Check logs above."}
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Cost Sheets</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Imported:</span>
                          <span className="font-semibold text-emerald-600">
                            {migrationResult.costSheets.imported}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Skipped:</span>
                          <span className="font-semibold">{migrationResult.costSheets.skipped}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Errors:</span>
                          <span className="font-semibold text-red-600">
                            {migrationResult.costSheets.errors}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Yarn Masters</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Imported:</span>
                          <span className="font-semibold text-emerald-600">
                            {migrationResult.yarnMasters.imported}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Skipped:</span>
                          <span className="font-semibold">{migrationResult.yarnMasters.skipped}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Errors:</span>
                          <span className="font-semibold text-red-600">
                            {migrationResult.yarnMasters.errors}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Inventory Items</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Imported:</span>
                          <span className="font-semibold text-emerald-600">
                            {migrationResult.inventoryItems.imported}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Skipped:</span>
                          <span className="font-semibold">{migrationResult.inventoryItems.skipped}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Errors:</span>
                          <span className="font-semibold text-red-600">
                            {migrationResult.inventoryItems.errors}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Transactions</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Imported:</span>
                          <span className="font-semibold text-emerald-600">
                            {migrationResult.inventoryTransactions.imported}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Skipped:</span>
                          <span className="font-semibold">
                            {migrationResult.inventoryTransactions.skipped}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Errors:</span>
                          <span className="font-semibold text-red-600">
                            {migrationResult.inventoryTransactions.errors}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-muted/30">
                    <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
                      <div>
                        Started: {migrationResult.startTime.toLocaleString()}
                      </div>
                      <div>
                        Duration: {fmt(migrationResult.duration / 1000, 1)}s
                      </div>
                      <div>
                        Total imported: {fmt(
                          migrationResult.costSheets.imported +
                            migrationResult.yarnMasters.imported +
                            migrationResult.inventoryItems.imported +
                            migrationResult.inventoryTransactions.imported,
                          0
                        )}{" "}
                        records
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          ) : null}
        </div>
      </Can>
    </AppShell>
  );
}
