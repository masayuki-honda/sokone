"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "sokone_recently_viewed";
const MAX_ITEMS = 10;

export interface RecentlyViewedProduct {
  id: string;
  name: string;
  viewedAt: number;
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedProduct[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addProduct = useCallback((id: string, name: string) => {
    setItems((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      const updated = [{ id, name, viewedAt: Date.now() }, ...filtered].slice(
        0,
        MAX_ITEMS,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  return { recentlyViewed: items, addProduct };
}
