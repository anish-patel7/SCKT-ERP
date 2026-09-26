import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { requireAuth } from "@/lib/route-guards";
import { AppShell } from "@/components/app-shell";
import { TransactionSearchForm } from "@/components/inventory/search-form";
import { TransactionSearchResultsTable } from "@/components/inventory/search-results-table";
import { useSearchTransactions, useExportSearchResults, useSearchFormState } from "@/hooks/useSearch";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory/search")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Transaction Search — SCKT ERP" },
      {
        name: "description",
        content:
          "Advanced transaction search with multi-dimensional filtering, date ranges, and CSV export.",
      },
      { property: "og:title", content: "Transaction Search — SCKT ERP" },
      {
        property: "og:description",
        content: "Search inventory transactions by date, type, item, location, and more.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TransactionSearchPage,
});

function TransactionSearchPage() {
  const [hasSearched, setHasSearched] = useState(false);
  const formState = useSearchFormState();

  // Search query
  const { data: searchResults, isLoading: isSearching } = useSearchTransactions(
    formState.getFilters(),
  );

  // Export mutation
  const { mutate: exportCSV, isPending: isExporting } = useExportSearchResults();

  const handleSearch = () => {
    setHasSearched(true);
  };

  const handleExport = () => {
    try {
      exportCSV(
        {
          filters: formState.getFilters(),
          filename: `inventory-transactions-${new Date().toISOString().split("T")[0]}.csv`,
        },
        {
          onSuccess: () => {
            toast.success("CSV exported successfully");
          },
          onError: () => {
            toast.error("Failed to export CSV");
          },
        },
      );
    } catch (error) {
      toast.error("Failed to export CSV");
    }
  };

  return (
    <AppShell
      title="Transaction Search"
      breadcrumb={[{ label: "Inventory" }, { label: "Search" }]}
    >
      <div className="space-y-6">
        {/* Search Form */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <TransactionSearchForm
              onSearch={handleSearch}
              isLoading={isSearching}
            />
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {hasSearched ? (
              <TransactionSearchResultsTable
                data={
                  searchResults || {
                    results: [],
                    total: 0,
                    page: 1,
                    pageSize: 50,
                    hasMore: false,
                  }
                }
                isLoading={isSearching}
                onPageChange={(page) => formState.setPage(page)}
                onExport={handleExport}
                isExporting={isExporting}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
                <Search className="mb-3 size-8 text-muted-foreground" />
                <div className="text-sm font-semibold text-foreground">
                  Start searching
                </div>
                <div className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Set your filters on the left and click "Search" to find transactions
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
