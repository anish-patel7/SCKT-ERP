import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWarpingService } from "@/features/production/warping/warping-service";
import type {
  BeamInput,
  BeamIssueInput,
  BeamMovementKind,
  BeamProductionLoadingInput,
  BeamReceiveInput,
  EmptyBeamInwardInput,
  LoadBeamInput,
  MaterialIssueInput,
  MaterialReturnInput,
  MoveBeamInput,
  UnloadBeamInput,
  YarnIssueUpdateInput,
} from "@/features/production/warping/warping-types";

/** Under the Production root key so the demo reset refreshes Warping too. */
const KEY = ["production-v1", "warping"] as const;

export function useWarpingMode() {
  return getWarpingService().mode;
}

export function useBeams() {
  return useQuery({ queryKey: [...KEY, "beams"], queryFn: () => getWarpingService().listBeams() });
}

export function useBeamMovements(kind?: BeamMovementKind) {
  return useQuery({
    queryKey: [...KEY, "movements", kind ?? "all"],
    queryFn: () => getWarpingService().listMovements(kind),
  });
}

export function useMaterialIssues() {
  return useQuery({
    queryKey: [...KEY, "material-issues"],
    queryFn: () => getWarpingService().listMaterialIssues(),
  });
}

export function useMaterialReturns() {
  return useQuery({
    queryKey: [...KEY, "material-returns"],
    queryFn: () => getWarpingService().listMaterialReturns(),
  });
}

export function useYarnIssueUpdates() {
  return useQuery({
    queryKey: [...KEY, "yarn-updates"],
    queryFn: () => getWarpingService().listYarnIssueUpdates(),
  });
}

function useWarpingMutation<I, R>(fn: (input: I) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

const svc = () => getWarpingService();
export const useInwardEmptyBeam = () =>
  useWarpingMutation((i: EmptyBeamInwardInput) => svc().inwardEmptyBeam(i));
export const useIssueBeam = () => useWarpingMutation((i: BeamIssueInput) => svc().issueBeam(i));
export const useProduceBeam = () => useWarpingMutation((i: BeamInput) => svc().produceBeam(i));
export const useReceiveBeam = () =>
  useWarpingMutation((i: BeamReceiveInput) => svc().receiveBeam(i));
export const useProduceAndLoadBeam = () =>
  useWarpingMutation((i: BeamProductionLoadingInput) => svc().produceAndLoadBeam(i));
export const useLoadBeam = () => useWarpingMutation((i: LoadBeamInput) => svc().loadBeam(i));
export const useUnloadBeam = () => useWarpingMutation((i: UnloadBeamInput) => svc().unloadBeam(i));
export const useMoveBeam = () => useWarpingMutation((i: MoveBeamInput) => svc().moveBeam(i));
export const useIssueMaterial = () =>
  useWarpingMutation((i: MaterialIssueInput) => svc().issueMaterial(i));
export const useReturnMaterial = () =>
  useWarpingMutation((i: MaterialReturnInput) => svc().returnMaterial(i));
export const useUpdateYarnIssue = () =>
  useWarpingMutation((i: YarnIssueUpdateInput) => svc().updateYarnIssue(i));
