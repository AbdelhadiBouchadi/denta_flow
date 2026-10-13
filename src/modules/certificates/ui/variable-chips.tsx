import { Badge } from "@/components/ui/badge";
import {
  CERTIFICATE_VARIABLE_DESCRIPTIONS,
  CERTIFICATE_VARIABLES,
} from "../constants";

/**
 * The variables a certificate body may use, as chips with their meaning — in
 * the template editor and under the builder's textarea. Read-only: they
 * document the syntax, they insert nothing.
 */
const VariableChips = () => (
  <ul className="flex min-w-0 flex-wrap gap-1.5">
    {CERTIFICATE_VARIABLES.map((variable) => (
      <li key={variable}>
        <Badge
          variant="outline"
          title={CERTIFICATE_VARIABLE_DESCRIPTIONS[variable]}
          className="font-mono"
        >
          {`{{${variable}}}`}
        </Badge>
      </li>
    ))}
  </ul>
);

/** The same list with each description written out — the settings screen. */
export const VariableLegend = () => (
  <dl className="grid min-w-0 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
    {CERTIFICATE_VARIABLES.map((variable) => (
      <div key={variable} className="contents">
        <dt>
          <Badge variant="outline" className="font-mono">
            {`{{${variable}}}`}
          </Badge>
        </dt>
        <dd className="text-muted-foreground min-w-0">
          {CERTIFICATE_VARIABLE_DESCRIPTIONS[variable]}
        </dd>
      </div>
    ))}
  </dl>
);

export default VariableChips;
