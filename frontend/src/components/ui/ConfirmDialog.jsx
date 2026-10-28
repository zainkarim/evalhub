import { AnimatePresence, m } from "motion/react"
import { useId, useRef } from "react"
import Button from "./Button"
import { useModalDialog } from "./useModalDialog"

// "Are you sure?" built on the native <dialog> (focus trap, inert page, top
// layer). The open/close/exit-animation lifecycle is in useModalDialog. Focus
// starts on Cancel, the safe choice, even for a danger confirm. The dim layer is
// pointer-events-none so a click on the transparent <dialog> is a backdrop click.
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  const { dialogRef, dialogProps, handleExitComplete } = useModalDialog({
    open,
    onRequestClose: onCancel,
    initialFocusRef: cancelRef,
    canDismiss: !loading,
  })

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-0 h-dvh max-h-none w-dvw max-w-none items-center justify-center bg-transparent p-0 text-ink backdrop:bg-transparent open:flex"
      {...dialogProps}
    >
      <AnimatePresence onExitComplete={handleExitComplete}>
        {open && (
          <m.div
            key="dim"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 bg-bg/75 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
        {open && (
          <m.div
            key="panel"
            className="relative mx-4 w-full max-w-md rounded-panel border border-line bg-surface p-6 shadow-lg"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-2 text-sm text-muted">
                {description}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button ref={cancelRef} variant="secondary" disabled={loading} onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </dialog>
  )
}

export default ConfirmDialog
