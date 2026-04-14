import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type PublicTables = Database["public"]["Tables"];
type TableName = keyof PublicTables;
type TableRow<T extends TableName> = PublicTables[T]["Row"];

type Dataset = Partial<{
  [K in TableName]: Array<TableRow<K>>;
}>;

type ErrorMap = Partial<Record<TableName, string>>;

type QueryResult<T> = PromiseLike<{
  data: T;
  error: { message: string } | null;
}>;

class FakeQuery<T extends TableName> implements QueryResult<TableRow<T>[] | TableRow<T> | null> {
  private filters: Array<(row: TableRow<T>) => boolean> = [];
  private orderBy:
    | {
        column: keyof TableRow<T>;
        ascending: boolean;
      }
    | undefined;
  private rowLimit: number | undefined;
  private expectSingle = false;

  constructor(
    private readonly tableName: T,
    private readonly dataset: Dataset,
    private readonly errorMap: ErrorMap,
  ) {}

  select(columns: string) {
    void columns;
    return this;
  }

  eq(column: keyof TableRow<T> & string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: keyof TableRow<T> & string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  or(expression: string) {
    const groups = Array.from(expression.matchAll(/and\(([^)]+)\)/g)).map(
      (match) => match[1],
    );

    const groupFilters = groups.map((group) => {
      const conditions = group.split(",").map((condition) => {
        const parts = condition.split(".eq.");
        return {
          column: parts[0] as keyof TableRow<T>,
          value: parts[1],
        };
      });

      return (row: TableRow<T>) =>
        conditions.every(({ column, value }) => String(row[column]) === value);
    });

    this.filters.push((row) => groupFilters.some((filter) => filter(row)));
    return this;
  }

  order(column: keyof TableRow<T> & string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending ?? true,
    };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  maybeSingle() {
    this.expectSingle = true;
    return this;
  }

  then<TResult1 = {
    data: TableRow<T>[] | TableRow<T> | null;
    error: { message: string } | null;
  }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: TableRow<T>[] | TableRow<T> | null;
          error: { message: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const tableError = this.errorMap[this.tableName];

    if (tableError) {
      return Promise.resolve({
        data: this.expectSingle ? null : [],
        error: { message: tableError },
      }).then(onfulfilled, onrejected);
    }

    let rows = [...((this.dataset[this.tableName] ?? []) as Array<TableRow<T>>)];

    for (const filter of this.filters) {
      rows = rows.filter(filter);
    }

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows.sort((left, right) => {
        const leftValue = left[column];
        const rightValue = right[column];

        if (leftValue === rightValue) {
          return 0;
        }

        if (leftValue === null) {
          return ascending ? 1 : -1;
        }

        if (rightValue === null) {
          return ascending ? -1 : 1;
        }

        const leftComparable = String(leftValue);
        const rightComparable = String(rightValue);

        return ascending
          ? leftComparable.localeCompare(rightComparable)
          : rightComparable.localeCompare(leftComparable);
      });
    }

    if (this.rowLimit !== undefined) {
      rows = rows.slice(0, this.rowLimit);
    }

    const payload = this.expectSingle
      ? { data: rows[0] ?? null, error: null }
      : { data: rows, error: null };

    return Promise.resolve(payload).then(onfulfilled, onrejected);
  }
}

export function createFakeSupabase(
  dataset: Dataset,
  errorMap: ErrorMap = {},
) {
  return {
    from(tableName: TableName) {
      return new FakeQuery(tableName, dataset, errorMap);
    },
  } as unknown as SupabaseClient<Database>;
}
