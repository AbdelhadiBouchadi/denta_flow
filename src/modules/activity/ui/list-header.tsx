import { ACTIVITY_COPY as COPY } from "../constants";

/**
 * Static chrome: a Server Component (06-ui.md §9). The controls need the
 * prefetched counts and staff list, so they live in the view, inside the
 * Suspense boundary.
 */
const ActivityListHeader = () => (
  <div className="flex flex-col gap-1 px-4 pt-6 pb-4 md:px-8">
    <h1 className="font-heading text-h1 text-foreground">{COPY.pageTitle}</h1>
    <p className="text-muted-foreground text-sm">{COPY.pageDescription}</p>
  </div>
);

export default ActivityListHeader;
