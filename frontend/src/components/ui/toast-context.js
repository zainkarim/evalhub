import { createContext, useContext } from "react"

export const ToastContext = createContext(null)

// const toast = useToast(); toast.success("Saved"); toast.error("Couldn't save",
// { title: "Save failed", duration: 0 }). duration is in ms (0 = stays until
// dismissed). Also toast.info(...) and toast.dismiss(id).
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error("useToast must be used inside <ToastProvider>")
  return context
}
