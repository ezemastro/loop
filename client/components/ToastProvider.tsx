import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { View } from "react-native";
import { onGlobalApiError } from "@/api/loop";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";
import Toast, { type ToastData, type ToastType } from "./Toast";

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "error", duration?: number) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsub = onGlobalApiError((message, errorCode) => {
      const friendlyMessage = getUserFriendlyErrorMessage({ message, errorCode });
      showToast(friendlyMessage, "error");
    });
    return unsub;
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 9999 }}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de un ToastProvider");
  }
  return ctx;
}
