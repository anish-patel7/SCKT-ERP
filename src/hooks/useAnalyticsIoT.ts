import { useState, useCallback } from 'react';
import { AnalyticsData } from '@/lib/analytics-store';

const STORAGE_KEY = 'sckt_analytics_data';

const DEFAULT_DATA: AnalyticsData = {
  looms: [],
  downtimeLogs: [],
  aiSuggestions: [],
};

export function useAnalyticsIoT() {
  const [data, setData] = useState<AnalyticsData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_DATA;
    } catch {
      return DEFAULT_DATA;
    }
  });

  const update = useCallback((updateFn: (prev: AnalyticsData) => AnalyticsData) => {
    setData((prev) => {
      const updated = updateFn(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        console.error('Failed to save analytics data');
      }
      return updated;
    });
  }, []);

  return { data, update };
}
