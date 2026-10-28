import { AnimatePresence, m } from "motion/react"
import { useEffect, useId, useRef } from "react"
import Button from "./Button"

// "Are you sure?" built on the native <dialog>: showModal() gives us the focus
// trap, an inert page behind it and the top layer for free.
//
// Closing is two-step so the exit animation can play: the parent sets `open` to
// false, the panel animates out, and only then (onExitComplete) do we call
// dialog.close() and put focus back where it was. Focus starts on Cancel, the
// safe choice, even for a danger confirm.
//
// The <dialog> itself fills the viewport (transparent) so a click that lands on
// it, not on the panel, is a backdrop click. The dim layer is pointer-events-none.
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
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const openerRef = useRef(null)
  const openRef = useRef(open)
  const pressedOnBackdrop = useRef(false)
  const closedByUs = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    openRef.current = open
    const dialog = dialogRef.current
    if (!open || !dialog) return
    if (!dialog.open) {
      openerRef.current = document.activeElement
      dialog.showModal()
    }
    cancelRef.current?.focus()
  }, [open])

  const handleExitComplete = () => {
    // The dim layer and the panel both report an exit; a late report after the
    // dialog was reopened must not close it again.
    if (openRef.current) return
    const dialog = dialogRef.current
    if (dialog?.open) {
      closedByUs.current = true
      dialog.close()
    }
    openerRef.current?.focus?.()
    openerRef.current = null
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-0 h-dvh max-h-none w-dvw max-w-none items-center justify-center bg-transparent p-0 text-ink backdrop:bg-transparent open:flex"
      // Esc: keep the dialog open and let the parent drive the close, so the
      // exit animation runs.
      onCancel={(event) => {
        event.preventDefault()
        if (!loading) onCancel?.()
      }}
      // The browser closed it by itself (e.g. a second Esc): tell the parent. The
      // event from our own close() is ignored, even if it arrives late.
      onClose={() => {
        if (closedByUs.current) {
          closedByUs.current = false
          return
        }
        if (openRef.current) onCancel?.()
      }}
      onPointerDown={(event) => {
        pressedOnBackdrop.current = event.target === dialogRef.current
      }}
      onClick={(event) => {
        const onBackdrop = event.target === dialogRef.current && pressedOnBackdrop.current
        pressedOnBackdrop.current = false
        if (onBackdrop && !loading) onCancel?.()
      }}
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
