import { create } from "zustand";

type UiState = {
  toast: { message: string; tone: "info" | "error" | "success" } | null;
  showToast: (message: string, tone?: "info" | "error" | "success") => void;
  clearToast: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (message, tone = "info") => set({ toast: { message, tone } }),
  clearToast: () => set({ toast: null }),
}));
