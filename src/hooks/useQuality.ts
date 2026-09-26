import { useCallback, useEffect, useState } from "react";
import { getQuality, saveQuality, type QualityData } from "@/lib/quality-store";

const EMPTY: QualityData = {
  inspections: [],
  shadeDips: [],
  labTests: [],
};

export function useQuality() {
  const [data, setData] = useState<QualityData>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(getQuality());
    setReady(true);
  }, []);

  const update = useCallback((fn: (prev: QualityData) => QualityData) => {
    setData((prev) => {
      const next = fn(prev);
      saveQuality(next);
      return next;
    });
  }, []);

  return { data, ready, update };
}
