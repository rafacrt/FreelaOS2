
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface SettingsState {
  showChronometer: boolean;
  toggleShowChronometer: () => void;
  setShowChronometer: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      showChronometer: true,
      toggleShowChronometer: () =>
        set((state) => {
          state.showChronometer = !state.showChronometer;
        }),
      setShowChronometer: (value) =>
        set((state) => {
          state.showChronometer = value;
        }),
    })),
    {
      name: 'freelaos-app-settings', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : { // Fallback for SSR
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
    }
  )
);
