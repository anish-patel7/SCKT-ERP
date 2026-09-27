import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWarpingService } from "@/features/production/warping/warping-service";
import type {
  BeamInput,
  BeamMovementKind,
  LoadBeamInput,
  MoveBeamInput,
  UnloadBeamInput,
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

function useWarpingMutation<I, R>(fn: (input: I) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const useProduceBeam = () =>
  useWarpingMutation((i: BeamInput) => getWarpingService().produceBeam(i));
export const useLoadBeam = () =>
  useWarpingMutation((i: LoadBeamInput) => getWarpingService().loadBeam(i));
export const useUnloadBeam = () =>
  useWarpingMutation((i: UnloadBeamInput) => getWarpingService().unloadBeam(i));
export const useMoveBeam = () =>
  useWarpingMutation((i: MoveBeamInput) => getWarpingService().moveBeam(i));
