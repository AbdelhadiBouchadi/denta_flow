import { TRPCError } from "@trpc/server";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { APPOINTMENT_SERVER_ERRORS } from "../constants";
import {
  postgresErrorCode,
  rethrowAppointmentWriteError,
  toAppointmentWriteError,
} from "./errors";
import { overlappingAppointment } from "./overlap";

/** What @neondatabase/serverless raises: an Error carrying the SQLSTATE. */
const pgError = (code: string, constraint?: string) =>
  Object.assign(new Error("violation"), { code, constraint });

/** What drizzle actually throws: the driver error wrapped on `cause`. */
const wrapped = (cause: Error) =>
  new DrizzleQueryError("insert into appointments …", [], cause);

describe("23P01 → CONFLICT", () => {
  it("maps the exclusion-constraint violation to CONFLICT with the French copy", () => {
    const error = toAppointmentWriteError(
      wrapped(pgError("23P01", "appointments_practitioner_no_overlap")),
    );
    expect(error).toBeInstanceOf(TRPCError);
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe(
      "Ce créneau vient d'être réservé. Merci d'en choisir un autre.",
    );
  });

  it("maps the raw, unwrapped driver error too", () => {
    expect(toAppointmentWriteError(pgError("23P01"))?.code).toBe("CONFLICT");
  });

  it("never attaches the failed query as a cause", () => {
    const error = toAppointmentWriteError(wrapped(pgError("23P01")));
    expect(error?.cause).toBeUndefined();
  });

  it("is thrown, not returned, by the rethrow helper", () => {
    expect(() =>
      rethrowAppointmentWriteError(wrapped(pgError("23P01"))),
    ).toThrow(APPOINTMENT_SERVER_ERRORS.slotJustTaken);
  });
});

describe("other Postgres errors", () => {
  it("maps a vanished patient, practitioner or type (23503) to BAD_REQUEST", () => {
    const error = toAppointmentWriteError(wrapped(pgError("23503")));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe(APPOINTMENT_SERVER_ERRORS.missingReference);
  });

  it("leaves an unknown error untouched", () => {
    const unknown = wrapped(pgError("42P01"));
    expect(toAppointmentWriteError(unknown)).toBeNull();
    expect(() => rethrowAppointmentWriteError(unknown)).toThrow(unknown);
  });

  it("reads no code from a non-error", () => {
    expect(postgresErrorCode("boom")).toBeNull();
    expect(postgresErrorCode(null)).toBeNull();
  });
});

describe("overlappingAppointment — the SQL predicate", () => {
  const dialect = new PgDialect();
  const startsAt = new Date("2026-06-15T09:00:00Z");
  const endsAt = new Date("2026-06-15T10:00:00Z");

  const render = (excludeId?: string) => {
    const condition = overlappingAppointment({
      practitionerId: "prac_1",
      startsAt,
      endsAt,
      excludeId,
    });
    if (!condition) throw new Error("no condition");
    return dialect.sqlToQuery(condition);
  };

  it("is half-open: strict < and >, the same as the '[)' constraint", () => {
    const { sql, params } = render();
    expect(sql).toContain('"appointments"."practitioner_id" = $1');
    expect(sql).toContain('"appointments"."status" <> $2');
    expect(sql).toContain('"appointments"."starts_at" < $3');
    expect(sql).toContain('"appointments"."ends_at" > $4');
    expect(sql).not.toContain("<=");
    expect(sql).not.toContain(">=");
    expect(params[0]).toBe("prac_1");
    expect(params[1]).toBe("canceled");
    // starts_at is compared to the END, ends_at to the START.
    expect(params[2]).toBe(endsAt.toISOString());
    expect(params[3]).toBe(startsAt.toISOString());
  });

  it("excludes the row being updated", () => {
    const { sql, params } = render("appt_1");
    expect(sql).toContain('"appointments"."id" <> $5');
    expect(params[4]).toBe("appt_1");
  });

  it("has no id clause on create", () => {
    expect(render().sql).not.toContain('"appointments"."id"');
  });
});
