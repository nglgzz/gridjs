import Tabular from '../tabular';
import { VNode } from 'preact';
import Cell from '../cell';
import { HTMLContentProps } from '../view/htmlElement';
import { OneDArray, TCell, TColumn } from '../types';

function cellMatches(
  rowIndex: number,
  cellIndex: number,
  cell: Cell,
  keyword: string,
  {
    columns,
    ignoreHiddenColumns,
    selector,
  }: {
    columns: OneDArray<TColumn>;
    ignoreHiddenColumns: boolean;
    selector?: (cell: TCell, rowIndex: number, cellIndex: number) => string;
  },
) {
  if (!cell) {
    return false;
  }

  if (ignoreHiddenColumns) {
    if (
      columns &&
      columns[cellIndex] &&
      typeof columns[cellIndex] === 'object'
    ) {
      const typedColumn = columns[cellIndex] as TColumn;
      if (typedColumn.hidden) {
        return false;
      }
    }
  }

  let data = '';

  if (typeof selector === 'function') {
    data = selector(cell.data, rowIndex, cellIndex);
  } else if (typeof cell.data === 'object') {
    // HTMLContent element
    const element = cell.data as VNode<HTMLContentProps>;
    if (element && element.props && element.props.content) {
      // TODO: we should only search in the content of the element. props.content is the entire HTML element
      data = element.props.content;
    }
  } else {
    // primitive types
    data = String(cell.data);
  }

  return new RegExp(keyword, 'gi').test(data);
}

function flatBooleanEval(expression: string, match: (kw: string) => boolean) {
  return expression.split(/ *\bOR\b */).some((or) => {
    return or.split(/ *\bAND\b */).every((and) => {
      const trimmedAnd = and.trim();

      if (trimmedAnd === 'true' || trimmedAnd === '') {
        return true;
      }

      if (trimmedAnd === 'false') {
        return false;
      }

      return match(trimmedAnd);
    });
  });
}

const topLevelExpressionsPattern = /\\\(([^()]+)\\\)/g;

function nestedBooleanEval(expression: string, match: (kw: string) => boolean) {
  const unwrappedExpression = expression.replace(
    topLevelExpressionsPattern,
    (_, group) => String(flatBooleanEval(group, match)),
  );

  if (topLevelExpressionsPattern.test(unwrappedExpression)) {
    return nestedBooleanEval(unwrappedExpression, match);
  }

  return flatBooleanEval(unwrappedExpression, match);
}

export default function (
  keyword: string,
  columns: OneDArray<TColumn>,
  ignoreHiddenColumns: boolean,
  tabular: Tabular,
  selector?: (cell: TCell, rowIndex: number, cellIndex: number) => string,
): Tabular {
  // escape special regex chars
  keyword = keyword.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');

  const rowMatches = (row, rowIndex) => (kw) =>
    row.cells.some((cell, cellIndex) =>
      cellMatches(rowIndex, cellIndex, cell, kw, {
        columns,
        ignoreHiddenColumns,
        selector,
      }),
    );

  return new Tabular(
    tabular.rows.filter((row, rowIndex) => {
      return nestedBooleanEval(keyword, rowMatches(row, rowIndex));
    }),
  );
}
