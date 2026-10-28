import { ArrowRight, Inbox, Plus, Save, Trash } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import ThemeToggle from "../../components/ThemeToggle"
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonCard,
  SkeletonRow,
  SkeletonText,
  StickyActionBar,
  TabPanel,
  Tabs,
  useToast,
} from "../../components/ui"

// Dev-only: App.jsx registers this route (and imports this file) only when
// import.meta.env.DEV, so none of it reaches the production build.

const VARIANTS = ["primary", "secondary", "ghost", "danger"]
const TONES = ["neutral", "success", "warning", "danger", "info", "accent"]

function Section({ title, note, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
        {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {label && <span className="w-24 shrink-0 text-xs text-muted">{label}</span>}
      {children}
    </div>
  )
}

function ButtonRows() {
  return (
    <div className="space-y-5">
      {VARIANTS.map((variant) =>
        ["md", "sm"].map((size) => (
          <div key={`${variant}-${size}`} className="space-y-2">
            <Row label={`${variant} ${size}`}>
              <Button variant={variant} size={size}>
                Default
              </Button>
              <Button variant={variant} size={size} disabled>
                Disabled
              </Button>
              <Button variant={variant} size={size} loading>
                Loading
              </Button>
              <Button variant={variant} size={size} icon={Plus}>
                Icon left
              </Button>
              <Button variant={variant} size={size} iconRight={ArrowRight}>
                Icon right
              </Button>
              <Button variant={variant} size={size} icon={Trash} aria-label="Delete (icon only)" />
              <Button variant={variant} size={size} to="/dev/ui">
                As link
              </Button>
            </Row>
          </div>
        )),
      )}
      <div className="max-w-xs space-y-2">
        <Button fullWidth>Full width</Button>
        <Button fullWidth variant="secondary">
          Full width secondary
        </Button>
      </div>
    </div>
  )
}

function Showcase({ theme, onToast }) {
  const uid = useId()
  const [tab, setTab] = useState("overview")
  const [dialog, setDialog] = useState(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const closeDialog = () => setDialog(null)
  const confirm = () => {
    if (dialog !== "loading") {
      closeDialog()
      return
    }
    setDialogLoading(true)
    timer.current = setTimeout(() => {
      setDialogLoading(false)
      closeDialog()
    }, 1500)
  }

  return (
    <div className="space-y-10">
      <Section title="Button" note="One primary per view. Loading keeps the width and the keyboard focus.">
        <ButtonRows />
      </Section>

      <Section title="Card">
        <div className="space-y-4">
          <Card>
            <p className="text-sm">A plain card with padding.</p>
          </Card>
          <Card padded={false}>
            <CardHeader
              as="h4"
              title="Card with sections"
              description="Header, body and footer carry their own padding."
              action={
                <Button size="sm" variant="secondary">
                  Edit
                </Button>
              }
            />
            <CardBody>
              <p className="text-sm text-muted">Body content goes here.</p>
            </CardBody>
            <CardFooter>
              <Button size="sm" variant="ghost">
                Cancel
              </Button>
              <Button size="sm">Save</Button>
            </CardFooter>
          </Card>
          <Card as="a" href="#card-interactive" interactive>
            <p className="text-sm font-medium">Interactive card (a link)</p>
            <p className="mt-1 text-sm text-muted">Border darkens on hover.</p>
          </Card>
        </div>
      </Section>

      <Section title="Badge">
        {["md", "sm"].map((size) => (
          <div key={size} className="space-y-2">
            <Row label={`${size}`}>
              {TONES.map((tone) => (
                <Badge key={tone} tone={tone} size={size}>
                  {tone}
                </Badge>
              ))}
            </Row>
            <Row label={`${size} + dot`}>
              {TONES.map((tone) => (
                <Badge key={tone} tone={tone} size={size} dot>
                  {tone}
                </Badge>
              ))}
            </Row>
          </div>
        ))}
      </Section>

      <Section title="PageHeader">
        <div className="space-y-6">
          <PageHeader titleAs="h4" title="Title only" />
          <PageHeader titleAs="h4" title="With subtitle" subtitle="One line saying what this page is for." />
          <PageHeader
            titleAs="h4"
            title="With back link"
            subtitle="Back goes to the parent page."
            backTo={{ to: "/dev/ui", label: "Back to Observations" }}
          />
          <PageHeader
            titleAs="h4"
            title="With breadcrumbs"
            breadcrumbLabel={`Breadcrumb (${theme})`}
            breadcrumbs={[{ label: "Courses", to: "/dev/ui" }, { label: "CS 2305", to: "/dev/ui" }, { label: "Section 001" }]}
          />
          <PageHeader
            titleAs="h4"
            title="With a primary action"
            subtitle="The action stacks under the title on a phone."
            action={<Button icon={Plus}>Add professor</Button>}
          />
        </div>
      </Section>

      <Section title="EmptyState">
        <div className="space-y-4">
          <EmptyState
            titleAs="h4"
            icon={Inbox}
            title="No requests yet"
            text="When a colleague asks you to observe a class, it will show up here."
            action={<Button variant="secondary">Request observation</Button>}
          />
          <EmptyState compact titleAs="h4" icon={Inbox} title="Nothing to show" text="Compact, for inside a card." />
        </div>
      </Section>

      <Section title="Skeleton">
        <div className="space-y-4">
          <SkeletonText />
          <Card padded={false} className="px-6">
            <SkeletonRow />
            <SkeletonRow />
          </Card>
          <SkeletonCard />
          <Skeleton className="h-10 w-40" />
        </div>
      </Section>

      <Section title="Tabs" note="Focus a tab, then use Left/Right/Home/End. The active tab has the orange underline.">
        <Tabs
          ariaLabel="Gallery tabs"
          idPrefix={`${uid}-tabs`}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "requests", label: "Requests", count: 3 },
            { id: "history", label: "History", count: 12 },
          ]}
        />
        {["overview", "requests", "history"].map((id) => (
          <TabPanel key={id} id={id} value={tab} idPrefix={`${uid}-tabs`} className="pt-4 text-sm text-muted">
            Panel for “{id}”.
          </TabPanel>
        ))}
      </Section>

      <Section title="ConfirmDialog" note="Esc and a click outside the panel cancel. Focus starts on Cancel and returns to the button.">
        <Row>
          <Button variant="secondary" onClick={() => setDialog("default")}>
            Open confirm
          </Button>
          <Button variant="danger" icon={Trash} onClick={() => setDialog("danger")}>
            Open danger confirm
          </Button>
          <Button variant="secondary" onClick={() => setDialog("loading")}>
            Open loading confirm
          </Button>
        </Row>
        <ConfirmDialog
          open={dialog === "default"}
          title="Save these changes?"
          description="You can edit them again later."
          confirmLabel="Save"
          onConfirm={confirm}
          onCancel={closeDialog}
        />
        <ConfirmDialog
          open={dialog === "danger"}
          tone="danger"
          title="Delete this criterion?"
          description="This removes it from every future observation form. This can't be undone."
          confirmLabel="Delete"
          onConfirm={confirm}
          onCancel={closeDialog}
        />
        <ConfirmDialog
          open={dialog === "loading"}
          title="Send the request?"
          description="Confirm to see the loading state (closes after 1.5 s)."
          confirmLabel="Send"
          loading={dialogLoading}
          onConfirm={confirm}
          onCancel={closeDialog}
        />
      </Section>

      <Section title="Toast" note="Toasts appear bottom-right on desktop, bottom-center on a phone, above the page action bar.">
        <Row>
          <Button variant="secondary" onClick={() => onToast.success("Your changes were saved.", { title: "Saved" })}>
            Success
          </Button>
          <Button variant="secondary" onClick={() => onToast.error("Couldn't reach the server. Try again.", { title: "Save failed" })}>
            Error
          </Button>
          <Button variant="secondary" onClick={() => onToast.info("The observer list opens on Friday.")}>
            Info
          </Button>
          <Button variant="secondary" onClick={() => onToast.info("Stays until you dismiss it.", { duration: 0 })}>
            Sticky
          </Button>
        </Row>
      </Section>

      <Section title="StickyActionBar" note="Back on the left, Cancel + Save on the right. Scroll the box.">
        <div className="h-56 overflow-y-auto rounded-card border border-line bg-surface">
          <div className="h-80 space-y-2 p-4 text-sm text-muted">
            <p>A long form would be here.</p>
            <p>Scroll down: the bar stays at the bottom edge.</p>
          </div>
          <StickyActionBar offsetToasts={false} back={{ label: "Back", onClick: () => {} }}>
            <Button size="sm" variant="secondary">
              Cancel
            </Button>
            <Button size="sm" icon={Save}>
              Save
            </Button>
          </StickyActionBar>
        </div>
      </Section>
    </div>
  )
}

function ThemePanel({ theme, children }) {
  return (
    <div className={`${theme} rounded-panel border border-line bg-bg p-4 text-ink sm:p-6`}>
      <h2 className="mb-6 text-lg font-semibold">{theme === "light" ? "Light" : "Dark"} theme</h2>
      {children}
    </div>
  )
}

function UiGallery() {
  const toast = useToast()
  const [pageBar, setPageBar] = useState(true)

  return (
    <div data-gallery="evalhub-ui-gallery-dev-only" className="min-h-screen bg-bg font-sans text-ink">
      <header className="brand-bar bg-brand text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">UI kit gallery</h1>
            <p className="text-xs text-white/90">Dev only. This page is not part of the production build.</p>
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pageBar} onChange={(event) => setPageBar(event.target.checked)} />
            Page action bar
          </label>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <ThemePanel theme="light">
            <Showcase theme="light" onToast={toast} />
          </ThemePanel>
          <ThemePanel theme="dark">
            <Showcase theme="dark" onToast={toast} />
          </ThemePanel>
        </div>
      </main>

      {pageBar && (
        <StickyActionBar back={{ label: "Back", onClick: () => window.scrollTo({ top: 0 }) }}>
          <Button size="sm" variant="secondary">
            Cancel
          </Button>
          <Button size="sm" icon={Save}>
            Save
          </Button>
        </StickyActionBar>
      )}
    </div>
  )
}

export default UiGallery
