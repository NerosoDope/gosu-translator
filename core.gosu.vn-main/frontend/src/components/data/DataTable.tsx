/**
 * Component: DataTable
 * Purpose:
 *   - Hiển thị dữ liệu dạng bảng với sort, search, filter
 *   - Hỗ trợ client-side sorting
 *   - Responsive và dark mode
 * 
 * Responsibilities:
 * - Render table với columns và data
 * - Handle sort cho các columns có sortable=true
 * - Hiển thị loading và empty states
 * - Support row click events
 */

"use client";

import React, { useState, useMemo } from 'react';

export type SortDirection = "asc" | "desc" | null;

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (item: T, index?: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  onSort?: (columnKey: string | null, direction: SortDirection) => void;
  sortColumn?: string | null;
  sortDirection?: SortDirection;
}

// Icons đơn giản cho sort
const ArrowUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function DataTable<T extends { id: number }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = "Không có dữ liệu",
  onRowClick,
  onSort,
  sortColumn: externalSortColumn,
  sortDirection: externalSortDirection,
}: DataTableProps<T>) {
  const [internalSortColumn, setInternalSortColumn] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(null);

  // Use external sort state if provided, otherwise use internal
  const sortColumn = externalSortColumn !== undefined ? externalSortColumn : internalSortColumn;
  const sortDirection = externalSortDirection !== undefined ? externalSortDirection : internalSortDirection;

  const handleSort = (columnKey: string) => {
    if (onSort) {
      // Use external sort handler
      if (sortColumn === columnKey) {
        if (sortDirection === "asc") {
          onSort(columnKey, "desc");
        } else if (sortDirection === "desc") {
          onSort(null, null);
        } else {
          onSort(columnKey, "asc");
        }
      } else {
        onSort(columnKey, "asc");
      }
    } else {
      // Use internal sort handler
      if (internalSortColumn === columnKey) {
        if (internalSortDirection === "asc") {
          setInternalSortDirection("desc");
        } else if (internalSortDirection === "desc") {
          setInternalSortColumn(null);
          setInternalSortDirection(null);
        } else {
          setInternalSortDirection("asc");
        }
      } else {
        setInternalSortColumn(columnKey);
        setInternalSortDirection("asc");
      }
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn as keyof T];
      const bValue = b[sortColumn as keyof T];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return (
        <span className="ml-1 inline-flex items-center">
          <ArrowUpIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
      );
    }
    if (sortDirection === "asc") {
      return (
        <span className="ml-1 inline-flex items-center">
          <ArrowUpIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </span>
      );
    }
    if (sortDirection === "desc") {
      return (
        <span className="ml-1 inline-flex items-center">
          <ArrowDownIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </span>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md overflow-hidden">
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md overflow-hidden">
        <div className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 ${
                    column.sortable
                      ? "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800 group"
                      : ""
                  } ${column.className || ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (column.sortable) {
                      handleSort(column.key as string);
                    }
                  }}
                >
                  <div className="flex items-center">
                    {column.header}
                    {column.sortable && getSortIcon(column.key as string)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedData.map((item, rowIndex) => (
              <tr
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={
                  onRowClick
                    ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                }
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${column.className || ""}`}
                  >
                    {column.render
                      ? column.render(item, rowIndex)
                      : (item[column.key as keyof T] as React.ReactNode) ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

