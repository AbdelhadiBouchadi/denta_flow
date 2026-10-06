import { count } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/constants";
import { appointments } from "@/database/schema";
import { getRangeForView } from "./lib/get-range-for-view";
import {
  clampPage,
  pageWindow,
  totalPagesFor,
  withPageReset,
} from "./pagination";
import {
  APPOINTMENT_LIST_ORDER,
  appointmentListWhere,
} from "./server/list-query";
import { AppointmentStatus, CalendarView } from "./types";

describe("page boundaries", () => {
  it("windows a 1-based page", () => {
    expect(pageWindow(1, 10)).toEqual({ limit: 10, offset: 0 });
    expect(pageWindow(2, 10)).toEqual({ limit: 10, offset: 10 });
    expect(pageWindow(9, 10)).toEqual({ limit: 10, offset: 80 });
  });

  it("never yields a negative offset", () => {
    expect(pageWindow(0, 10).offset).toBe(0);
  });

  it("counts pages, an exact multiple included", () => {
    expect(totalPagesFor(0, 10)).toBe(0);
    expect(totalPagesFor(1, 10)).toBe(1);
    expect(totalPagesFor(10, 10)).toBe(1);
    expect(totalPagesFor(11, 10)).toBe(2);
    expect(totalPagesFor(87, 10)).toBe(9);
  });

  it("clamps a page past the end to the last page", () => {
    expect(clampPage(5, 4)).toBe(4);
    expect(clampPage(4, 4)).toBe(4);
    expect(clampPage(2, 4)).toBe(2);
  });

  it("clamps to page 1 for an empty list or a nonsense page", () => {
    expect(clampPage(3, 0)).toBe(1);
    expect(clampPage(0, 4)).toBe(1);
  });
});

describe("page reset", () => {
  it("sends any filter change back to page 1", () => {
    expect(withPageReset({ status: AppointmentStatus.Confirmed })).toEqual({
      status: AppointmentStatus.Confirmed,
      page: DEFAULT_PAGE,
    });
  });

  it("resets on a range or view change too", () => {
    expect(withPageReset({ date: "2026-03-12", view: CalendarView.Month })).toEqual(
      { date: "2026-03-12", view: CalendarView.Month, page: DEFAULT_PAGE },
    );
  });

  it("overrides a page passed alongside the change", () => {
    expect(withPageReset({ page: 7, practitionerId: "p1" }).page).toBe(
      DEFAULT_PAGE,
    );
  });
});

/**
 * Stable ordering, simulated: paging a list that has ties on `startsAt`
 * with the same (startsAt, id) order the SQL uses must visit every row
 * exactly once.
 */
describe("stable ordering across a tie", () => {
  type Row = { id: string; startsAt: number };
  const byStartThenId = (a: Row, b: Row) =>
    a.startsAt - b.startsAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // 23 rows, many sharing an instant — two practitioners at 09:00, etc.
  const rows: Row[] = Array.from({ length: 23 }, (_, i) => ({
    id: `appt_${String((i * 7) % 23).padStart(2, "0")}`,
    startsAt: Math.floor(i / 3),
  }));

  const pageOf = (page: number, pageSize: number) => {
    const { limit, offset } = pageWindow(page, pageSize);
    // Shuffled input each time: the database owes no order before ORDER BY.
    return [...rows]
      .sort(() => Math.random() - 0.5)
      .sort(byStartThenId)
      .slice(offset, offset + limit);
  };

  it("visits every row exactly once across pages", () => {
    const pageSize = 5;
    const pages = totalPagesFor(rows.length, pageSize);
    const seen = Array.from({ length: pages }, (_, i) =>
      pageOf(i + 1, pageSize),
    ).flat();

    expect(seen).toHaveLength(rows.length);
    expect(new Set(seen.map((row) => row.id)).size).toBe(rows.length);
    expect(seen).toEqual([...rows].sort(byStartThenId));
  });

  it("orders by starts_at then id in SQL", () => {
    const { sql } = new QueryBuilder()
      .select({ id: appointments.id })
      .from(appointments)
      .orderBy(...APPOINTMENT_LIST_ORDER)
      .toSQL();
    expect(sql).toMatch(
      /order by "appointments"\."starts_at" asc, "appointments"\."id" asc$/,
    );
  });
});

describe("total matches the filters", () => {
  const range = getRangeForView("2026-03-12", CalendarView.Month);
  const filters = {
    practitionerId: "prac_1",
    status: AppointmentStatus.Confirmed,
    patientId: null,
  };
  const qb = new QueryBuilder();
  const where = appointmentListWhere(range, filters);

  it("the page query and the count share one predicate, params included", () => {
    const { limit, offset } = pageWindow(2, DEFAULT_PAGE_SIZE);
    const page = qb
      .select({ id: appointments.id })
      .from(appointments)
      .where(where)
      .orderBy(...APPOINTMENT_LIST_ORDER)
      .limit(limit)
      .offset(offset)
      .toSQL();
    const total = qb
      .select({ count: count() })
      .from(appointments)
      .where(where)
      .toSQL();

    const whereOf = (sql: string) =>
      sql.slice(sql.indexOf(" where "), sql.search(/ order by |$/));
    expect(whereOf(page.sql)).toBe(whereOf(total.sql));
    // The count's params are the page's minus LIMIT / OFFSET.
    expect(page.params.slice(0, total.params.length)).toEqual(total.params);
  });

  it("filters on the range, the practitioner and the status", () => {
    const { sql, params } = qb
      .select({ count: count() })
      .from(appointments)
      .where(where)
      .toSQL();
    expect(sql).toContain('"appointments"."starts_at" >= $1');
    expect(sql).toContain('"appointments"."starts_at" < $2');
    expect(sql).toContain('"appointments"."practitioner_id" = $3');
    expect(sql).toContain('"appointments"."status" = $4');
    expect(sql).not.toContain("patient_id");
    expect(params).toEqual([
      range.from.toISOString(),
      range.to.toISOString(),
      "prac_1",
      "confirmed",
    ]);
  });

  it("drops a filter left empty", () => {
    const { sql } = qb
      .select({ count: count() })
      .from(appointments)
      .where(appointmentListWhere(range, { practitionerId: "", status: null }))
      .toSQL();
    expect(sql).not.toContain("practitioner_id");
    expect(sql).not.toContain('"status"');
  });
});
