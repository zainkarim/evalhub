import { useEffect, useRef } from "react"

// The native <dialog> lifecycle shared by ConfirmDialog and the mobile nav.
// showModal() gives the focus trap, an inert page and the top layer for free.
//
// Closing is two-step so an exit animation can play: the parent sets `open` to
// false, the content animates out, and only then (handleExitComplete, wired to
// AnimatePresence's onExitComplete) do we call dialog.close() and put focus back.
//
//  - openRef: a late exit report after the dialog was reopened must not close it.
//  - closedByUs: the `close` event from our own close() is ignored, even if it
//    arrives late, so it can't be mistaken for the browser closing the dialog.
//
// Spread `dialogProps` onto the <dialog>. The <dialog> itself must fill the
// viewport (transparent) so a click that lands on it, not on the panel, is a
// backdrop click. `canDismiss={false}` (e.g. while loading) turns off Esc and
// backdrop dismissal.
export function useModalDialog({ open, onRequestClose, initialFocusRef, returnFocusRef, canDismiss = true }) {
  const dialogRef = useRef(null)
  const openerRef = useRef(null)
  const openRef = useRef(open)
  const pressedOnBackdrop = useRef(false)
  const closedByUs = useRef(false)

  useEffect(() => {
    openRef.current = open
    const dialog = dialogRef.current
    if (!open || !dialog) return
    if (!dialog.open) {
      openerRef.current = returnFocusRef?.current ?? document.activeElement
      dialog.showModal()
    }
    initialFocusRef?.current?.focus()
  }, [open, initialFocusRef, returnFocusRef])

  const handleExitComplete = () => {
    if (openRef.current) return
    const dialog = dialogRef.current
    if (dialog?.open) {
      closedByUs.current = true
      dialog.close()
    }
    openerRef.current?.focus?.()
    openerRef.current = null
  }

  const dialogProps = {
    // Esc: keep the dialog open and let the parent drive the close, so the exit
    // animation runs.
    onCancel: (event) => {
      event.preventDefault()
      if (canDismiss) onRequestClose?.()
    },
    // The browser closed it by itself (e.g. a second Esc): tell the parent.
    onClose: () => {
      if (closedByUs.current) {
        closedByUs.current = false
        return
      }
      if (openRef.current) onRequestClose?.()
    },
    // A backdrop click needs the press AND the click on the dialog element, so
    // dragging from inside the panel and releasing outside doesn't close it.
    onPointerDown: (event) => {
      pressedOnBackdrop.current = event.target === dialogRef.current
    },
    onClick: (event) => {
      const onBackdrop = event.target === dialogRef.current && pressedOnBackdrop.current
      pressedOnBackdrop.current = false
      if (onBackdrop && canDismiss) onRequestClose?.()
    },
  }

  return { dialogRef, dialogProps, handleExitComplete }
}
