import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

// Stateless: the URL is the state.
const DataPagination = ({ page, totalPages, onPageChange }: Props) => {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground flex-1 text-sm">
        Page {page} sur {totalPages || 1}
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          disabled={page === 1}
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ArrowLeftIcon className="size-4" />
          Précédent
        </Button>
        <Button
          disabled={page === totalPages || totalPages === 0}
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Suivant
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
};

export default DataPagination;
