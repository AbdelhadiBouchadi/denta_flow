import { appointmentTypesRouter } from "@/modules/appointment-types/server/procedures";
import { appointmentsRouter } from "@/modules/appointments/server/procedures";
import { clinicRouter } from "@/modules/clinic/server/procedures";
import { dashboardRouter } from "@/modules/dashboard/server/procedures";
import { documentsRouter } from "@/modules/documents/server/procedures";
import { insurersRouter } from "@/modules/insurers/server/procedures";
import { patientsRouter } from "@/modules/patients/server/procedures";
import { paymentsRouter } from "@/modules/payments/server/procedures";
import { schedulesRouter } from "@/modules/schedules/server/procedures";
import { servicesRouter } from "@/modules/services/server/procedures";
import { staffRouter } from "@/modules/staff/server/procedures";
import { tagsRouter } from "@/modules/tags/server/procedures";
import { treatmentsRouter } from "@/modules/treatments/server/procedures";

import { createTRPCRouter } from "../init";

/**
 * The only place slices are registered — one line each. A procedure defined
 * inline here means the rule has been broken (03-trpc.md §5).
 *
 * The temporary `health.ping` router is gone: it existed only to prove the
 * superjson round-trip until the first slice landed, and `patients.getOne`
 * now returns `createdAt` as a real Date through the same transformer.
 */
export const appRouter = createTRPCRouter({
  patients: patientsRouter,
  tags: tagsRouter,
  insurers: insurersRouter,
  clinic: clinicRouter,
  staff: staffRouter,
  services: servicesRouter,
  appointmentTypes: appointmentTypesRouter,
  schedules: schedulesRouter,
  appointments: appointmentsRouter,
  treatments: treatmentsRouter,
  payments: paymentsRouter,
  documents: documentsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
