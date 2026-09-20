import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/modules/dashboard/ui/app-sidebar";
import { SiteHeader } from "@/modules/dashboard/ui/site-header";

interface Props {
  children: React.ReactNode;
}

/**
 * The frame every dashboard route renders inside: sidebar, navbar, content.
 *
 * It lives in the slice rather than in `(dashboard)/layout.tsx` because a file
 * under `src/app/` is a routing shell and carries no layout JSX of its own
 * (AGENTS.md §1.1) — the same split as <AuthShell />.
 *
 * Structural only: no domain data, no session check. The pages redirect.
 *
 * The two widths are set here, on the provider, so the sidebar and the header
 * read one source: 17rem and 3.5rem expressed in the 4px spacing base
 * (06-ui.md §1) rather than as loose pixel values.
 */
const DashboardShell = ({ children }: Props) => {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />

      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default DashboardShell;
