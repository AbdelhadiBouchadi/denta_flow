import { WHATSAPP_COPY as COPY } from "../constants";

/**
 * Static chrome: a Server Component (06-ui.md §9). The day picker and the
 * chips need the prefetched day, so they live in the view.
 */
const RappelsListHeader = () => (
  <div className="flex flex-col gap-1 px-4 pt-6 pb-4 md:px-8">
    <h1 className="font-heading text-h1 text-foreground">{COPY.rappelsTitle}</h1>
    <p className="text-muted-foreground text-sm">{COPY.rappelsDescription}</p>
  </div>
);

export default RappelsListHeader;
