"use client";

import { createContext, useContext, useState } from "react";

interface SelectionState {
  selected: number | null;
  setSelected: (i: number | null) => void;
}

const SelectionContext = createContext<SelectionState>({
  selected: null,
  setSelected: () => {},
});

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <SelectionContext.Provider value={{ selected, setSelected }}>
      {children}
    </SelectionContext.Provider>
  );
}

export const useSelection = () => useContext(SelectionContext);
