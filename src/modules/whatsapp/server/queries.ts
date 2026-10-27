import "server-only";

import { and, count, eq, gt, inArray, lte } from "drizzle-orm";

import { db } from "@/database";
import { appointments, whatsappMessages } from "@/database/schema";
import { ATTENTION_HORIZON_HOURS } from "../constants";

/**
 * «À vérifier»: `needs_attention` or `failed` messages about appointments in
 * the next 48 hours. ONE definition, read by `whatsapp.getAttentionCount`
 * and by the dashboard's `getStats` (inside its own batch).
 */
export const attentionCountQuery = (now: Date) =>
  db
    .select({ count: count() })
    .from(whatsappMessages)
    .innerJoin(appointments, eq(whatsappMessages.appointmentId, appointments.id))
    .where(
      and(
        inArray(whatsappMessages.status, ["needs_attention", "failed"]),
        gt(appointments.startsAt, now),
        lte(
          appointments.startsAt,
          new Date(now.getTime() + ATTENTION_HORIZON_HOURS * 3_600_000),
        ),
      ),
    );
