import { z } from "zod";

import { customRangeError } from "./period";
import { StatisticsPeriod } from "./types";

/**
 * The input of EVERY statistics procedure: a preset, or a custom range of
 * clinic calendar days. The same schema validates the URL in the view
 * (`useStatisticsInput`) and the input on the server, so the header and
 * the procedure refuse a range with the same French sentence.
 *
 * «Today» is read at validation time on the clinic clock: a custom `to`
 * may be today, never later.
 */
export const statisticsInputSchema = z
  .object({
    period: z.enum(StatisticsPeriod),
    from: z.string().max(10),
    to: z.string().max(10),
  })
  .superRefine((value, ctx) => {
    const error = customRangeError(value, new Date());
    if (error) {
      ctx.addIssue({ code: "custom", message: error, path: ["from"] });
    }
  });

export type StatisticsInput = z.infer<typeof statisticsInputSchema>;
