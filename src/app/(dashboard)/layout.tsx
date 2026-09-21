import DashboardShell from "@/modules/dashboard/ui/dashboard-shell";

interface Props {
  children: React.ReactNode;
}

/**
 * Structural only. It fetches nothing and gates nothing: the session check is
 * tier 2 in 02-auth.md §3 and belongs to each page, where the redirect can be
 * decided alongside what that page prefetches.
 */
const DashboardLayout = ({ children }: Props) => {
  return <DashboardShell>{children}</DashboardShell>;
};

export default DashboardLayout;
