import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCostSheetsList,
  useCostSheetDetail,
  useCreateCostSheet,
  useUpdateCostSheet,
  useApproveCostSheet,
  useCreateCostSheetVersion,
  useDuplicateCostSheet,
  useDeleteCostSheet,
  useComputeCostSheetTotals,
} from "../useCostSheets";
import { costSheetsService, type CostSheetFull } from "@/services/costSheets";
import { toast } from "sonner";

/**
 * STEP 10 Phase 5: Hook Integration Tests for useCostSheets
 *
 * Tests TanStack Query behavior:
 * - Query hooks: loading, data, error states
 * - Mutation hooks: pending, success, error handlers
 * - Cache invalidation on mutations
 * - Toast notifications
 * - Query key dependencies
 */

// Mock service and toast
vi.mock("@/services/costSheets");
vi.mock("sonner");

// Mock data
const mockCostSheetFull: CostSheetFull = {
  header: {
    id: "test-sheet-1",
    sheet_no: "CS-TEST-001",
    design_no: "D-TEST-001",
    party_id: null,
    party_name: "Test Party Ltd",
    quality: "Test Quality",
    reed: 120,
    pick: 160,
    panna_inch: 49.5,
    length_metre: 6.65,
    wastage_pct: 10,
    card_rate: 0.4,
    number_of_cards: 17226,
    kg_divisor: 9000000,
    card_divisor: 39.37,
    status: "draft",
    version: 1,
    remarks: "Test cost sheet",
    costing_date: "2026-09-20",
    prepared_by: "Test User",
    unit_basis: "per metre",
    markup_pct: 0,
    manual_sale_rate: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "test@example.com",
    updated_by: undefined,
    approved_by: undefined,
    approved_at: undefined,
  },
  lines: [
    {
      id: "test-line-1",
      section: "warp",
      label: "WARP 1",
      material_id: null,
      yarn_name: "Test Yarn",
      quantity: 100,
      denier: 35,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 232,
    },
  ],
  charges: [
    {
      id: "test-charge-1",
      charge_name: "Butta",
      rate: 2,
      quantity: 6.65,
    },
  ],
};

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCostSheets Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Query Hooks", () => {
    describe("useCostSheetsList", () => {
      it("should fetch all cost sheets on mount", async () => {
        const mockList = [mockCostSheetFull];
        vi.mocked(costSheetsService.list).mockResolvedValue(mockList);

        const { result } = renderHook(() => useCostSheetsList(), {
          wrapper: createWrapper(),
        });

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(mockList);
        expect(costSheetsService.list).toHaveBeenCalled();
      });

      it("should handle list fetch errors", async () => {
        const error = new Error("Failed to fetch");
        vi.mocked(costSheetsService.list).mockRejectedValue(error);

        const { result } = renderHook(() => useCostSheetsList(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });

      it("should cache results (staleTime: 5 minutes)", async () => {
        const mockList = [mockCostSheetFull];
        vi.mocked(costSheetsService.list).mockResolvedValue(mockList);

        const { result: result1 } = renderHook(() => useCostSheetsList(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result1.current.data).toEqual(mockList);
        });

        // Second call should use cache
        const { result: result2 } = renderHook(() => useCostSheetsList(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result2.current.data).toEqual(mockList);
        });

        // Service should be called only once due to caching
        expect(costSheetsService.list).toHaveBeenCalledTimes(1);
      });
    });

    describe("useCostSheetDetail", () => {
      it("should fetch a single cost sheet by ID", async () => {
        vi.mocked(costSheetsService.getById).mockResolvedValue(mockCostSheetFull);

        const { result } = renderHook(() => useCostSheetDetail("test-sheet-1"), {
          wrapper: createWrapper(),
        });

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(mockCostSheetFull);
        expect(costSheetsService.getById).toHaveBeenCalledWith("test-sheet-1");
      });

      it("should not fetch if ID is not provided (enabled: false)", () => {
        const { result } = renderHook(() => useCostSheetDetail(undefined), {
          wrapper: createWrapper(),
        });

        expect(result.current.isLoading).toBe(false);
        expect(costSheetsService.getById).not.toHaveBeenCalled();
      });

      it("should handle detail fetch errors", async () => {
        const error = new Error("Sheet not found");
        vi.mocked(costSheetsService.getById).mockRejectedValue(error);

        const { result } = renderHook(() => useCostSheetDetail("nonexistent"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });
    });
  });

  describe("Mutation Hooks", () => {
    describe("useCreateCostSheet", () => {
      it("should create a new cost sheet and show success toast", async () => {
        vi.mocked(costSheetsService.create).mockResolvedValue(mockCostSheetFull);
        vi.mocked(toast.success).mockImplementation(() => {});

        const { result } = renderHook(() => useCreateCostSheet(), {
          wrapper: createWrapper(),
        });

        expect(result.current.isPending).toBe(false);

        act(() => {
          result.current.mutate(mockCostSheetFull);
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(result.current.data).toEqual(mockCostSheetFull);
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("CS-TEST-001"));
      });

      it("should handle validation errors", async () => {
        const validationError = new Error("Invalid data");
        Object.assign(validationError, { field: "sheet_no" });
        vi.mocked(costSheetsService.create).mockRejectedValue(validationError);
        vi.mocked(toast.error).mockImplementation(() => {});

        const { result } = renderHook(() => useCreateCostSheet(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.mutate({});
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(toast.error).toHaveBeenCalled();
      });
    });

    describe("useUpdateCostSheet", () => {
      it("should update a cost sheet and invalidate cache", async () => {
        const updatedSheet = { ...mockCostSheetFull };
        updatedSheet.header.quality = "Updated Quality";
        vi.mocked(costSheetsService.update).mockResolvedValue(updatedSheet);
        vi.mocked(toast.success).mockImplementation(() => {});

        const { result } = renderHook(() => useUpdateCostSheet(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.mutate({ id: "test-sheet-1", data: updatedSheet });
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(result.current.data).toEqual(updatedSheet);
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("saved"));
      });
    });

    describe("useApproveCostSheet", () => {
      it("should approve a cost sheet", async () => {
        const approvedSheet = { ...mockCostSheetFull };
        approvedSheet.header.status = "approved";
        approvedSheet.header.approved_by = "admin@example.com";
        approvedSheet.header.approved_at = new Date().toISOString();
        vi.mocked(costSheetsService.approve).mockResolvedValue(approvedSheet);
        vi.mocked(toast.success).mockImplementation(() => {});

        const { result } = renderHook(() => useApproveCostSheet(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.mutate("test-sheet-1");
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(result.current.data?.header.status).toBe("approved");
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("approved"));
      });
    });

    describe("useCreateCostSheetVersion", () => {
      it("should create a new version", async () => {
        const versionSheet = { ...mockCostSheetFull };
        versionSheet.header.version = 2;
        versionSheet.header.status = "draft";
        vi.mocked(costSheetsService.createVersion).mockResolvedValue(versionSheet);
        vi.mocked(toast.success).mockImplementation(() => {});

        const { result } = renderHook(() => useCreateCostSheetVersion(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.mutate("test-sheet-1");
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(result.current.data?.header.version).toBe(2);
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Version 2"));
      });
    });

    describe("useDuplicateCostSheet", () => {
      it("should duplicate a cost sheet", async () => {
        const duplicateSheet = { ...mockCostSheetFull };
        duplicateSheet.header.sheet_no = "CS-TEST-001-DUP";
        vi.mocked(costSheetsService.duplicate).mockResolvedValue(duplicateSheet);
        vi.mocked(toast.success).mockImplementation(() => {});

        const { result } = renderHook(() => useDuplicateCostSheet(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.mutate({
            originalId: "test-sheet-1",
            newSheetNo: "CS-TEST-001-DUP",
          });
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(result.current.data?.header.sheet_no).toBe("CS-TEST-001-DUP");
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("duplicated"));
      });
    });

    describe("useDeleteCostSheet", () => {
      it("should delete a cost sheet", async () => {
        vi.mocked(costSheetsService.delete).mockResolvedValue(undefined);
        vi.mocked(toast.success).mockImplementation(() => {});

        const { result } = renderHook(() => useDeleteCostSheet(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.mutate("test-sheet-1");
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(costSheetsService.delete).toHaveBeenCalledWith("test-sheet-1");
        expect(toast.success).toHaveBeenCalledWith("Cost sheet deleted");
      });
    });
  });

  describe("Calculation Hook", () => {
    it("useComputeCostSheetTotals should compute totals synchronously", () => {
      const result = useComputeCostSheetTotals(mockCostSheetFull.lines, mockCostSheetFull.charges, {
        wastage_pct: mockCostSheetFull.header.wastage_pct,
        card_rate: mockCostSheetFull.header.card_rate,
        number_of_cards: mockCostSheetFull.header.number_of_cards,
        kg_divisor: mockCostSheetFull.header.kg_divisor,
        card_divisor: mockCostSheetFull.header.card_divisor,
      });

      expect(result).toBeDefined();
      expect(result.totalKg).toBeGreaterThan(0);
      expect(result.warpCost).toBeGreaterThan(0);
    });
  });

  describe("Cache Invalidation", () => {
    it("should invalidate list cache on create mutation", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(costSheetsService.create).mockResolvedValue(mockCostSheetFull);
      vi.mocked(toast.success).mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateCostSheet(), { wrapper });

      act(() => {
        result.current.mutate(mockCostSheetFull);
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["cost_sheets"],
      });
    });

    it("should invalidate both list and detail cache on update mutation", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(costSheetsService.update).mockResolvedValue(mockCostSheetFull);
      vi.mocked(toast.success).mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateCostSheet(), { wrapper });

      act(() => {
        result.current.mutate({
          id: "test-sheet-1",
          data: mockCostSheetFull,
        });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      // Should invalidate both list and detail queries
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["cost_sheets"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["cost_sheets", "test-sheet-1"],
      });
    });
  });
});
