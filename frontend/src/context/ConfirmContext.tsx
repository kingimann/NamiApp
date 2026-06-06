import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import ConfirmModal from "@/src/components/ConfirmModal";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** `const confirm = useConfirm(); if (await confirm({ title, ... })) { ... }` */
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => { resolver.current = resolve; setOpts(o); });
  }, []);

  const finish = (v: boolean) => { setOpts(null); const r = resolver.current; resolver.current = null; r?.(v); };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <ConfirmModal
        visible={!!opts}
        title={opts?.title || ""}
        message={opts?.message}
        confirmLabel={opts?.confirmLabel}
        cancelLabel={opts?.cancelLabel}
        destructive={opts?.destructive}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </ConfirmCtx.Provider>
  );
}
