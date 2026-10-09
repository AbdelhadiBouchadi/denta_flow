import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Appointment` is a bug
 * (AGENTS.md §1 rule 6).
 */
type AppointmentsOutputs = inferRouterOutputs<AppRouter>["appointments"];

/** The item array, not the envelope — columns want `AppointmentGetMany[number]`. */
export type AppointmentGetMany = AppointmentsOutputs["getMany"]["items"];

export type AppointmentListItem = AppointmentGetMany[number];

export type AppointmentGetOne = AppointmentsOutputs["getOne"];

export type AppointmentByPatientItem =
  AppointmentsOutputs["getManyByPatient"]["items"][number];

export type WaitingRoom = AppointmentsOutputs["getWaitingRoom"];

export type WaitingRoomItem = WaitingRoom["items"][number];

/** What `create` and `update` answer — a booking, or a request to confirm one. */
export type AppointmentWriteResult = AppointmentsOutputs["create"];

/** Mirrors the `appointment_status` pgEnum, kept in lockstep. */
export enum AppointmentStatus {
  Planned = "planned",
  Confirmed = "confirmed",
  Arrived = "arrived",
  Completed = "completed",
  Canceled = "canceled",
  NoShow = "no_show",
}

/**
 * The agenda's views. English keys, they are URL values (AGENTS.md §5). The
 * date range each one covers is derived by `lib/get-range-for-view.ts`, never
 * stored.
 */
export enum CalendarView {
  Day = "day",
  Week = "week",
  Month = "month",
  Agenda = "agenda",
}

/**
 * Why a booking sits outside a practitioner's hours. A warning, never an
 * error: clinics run overtime (08-clinical.md §4 rule 7).
 */
export enum BookingWarning {
  /** Outside every range of the practitioner's weekly hours that day. */
  OutsideSchedule = "outside_schedule",
  /** Inside a leave or a clinic-wide closure. */
  Closure = "closure",
}
