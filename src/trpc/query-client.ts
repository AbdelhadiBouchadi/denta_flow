import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Never 0 — a prefetched query would refetch the moment it hydrates.
      queries: { staleTime: 30 * 1000 },
      dehydrate: {
        serializeData: superjson.serialize,
        // Dehydrate PENDING queries too — this is what lets a `void` prefetch stream.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });
}
