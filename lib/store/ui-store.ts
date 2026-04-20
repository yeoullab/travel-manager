import { create } from "zustand";

type Tone = "info" | "error" | "success";

type UiState = {
  toast: { message: string; tone: Tone } | null;
  showToast: (message: string, tone?: Tone) => void;
  clearToast: () => void;

  isDraggingSchedule: boolean;
  setDraggingSchedule: (value: boolean) => void;

  pendingScheduleInvalidate: boolean;
  setPendingScheduleInvalidate: (value: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (message, tone = "info") => set({ toast: { message, tone } }),
  clearToast: () => set({ toast: null }),

  isDraggingSchedule: false,
  setDraggingSchedule: (value) => set({ isDraggingSchedule: value }),

  pendingScheduleInvalidate: false,
  setPendingScheduleInvalidate: (value) => set({ pendingScheduleInvalidate: value }),
}));
