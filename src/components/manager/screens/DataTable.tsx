import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Array<Column<T>>;
}) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn("whitespace-nowrap text-xs uppercase tracking-wide", c.className)}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-border">
              {columns.map((c) => (
                <TableCell key={c.key} className={cn("py-3 text-sm", c.className)}>
                  {c.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
