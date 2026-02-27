"use client";

import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  // Always show first page
  pages.push(1);

  if (current <= 4) {
    // Near the start: 1 2 3 4 5 ... last
    for (let i = 2; i <= Math.min(5, total - 1); i++) pages.push(i);
    pages.push('...');
  } else if (current >= total - 3) {
    // Near the end: 1 ... last-4 last-3 last-2 last-1 last
    pages.push('...');
    for (let i = Math.max(total - 4, 2); i <= total - 1; i++) pages.push(i);
  } else {
    // Middle: 1 ... cur-1 cur cur+1 ... last
    pages.push('...');
    pages.push(current - 1);
    pages.push(current);
    pages.push(current + 1);
    pages.push('...');
  }

  // Always show last page
  pages.push(total);

  return pages;
}

const btnBase =
  'px-3 py-1 text-sm border rounded-lg transition-colors dark:border-gray-700';
const btnNormal =
  `${btnBase} hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300`;
const btnActive =
  `${btnBase} bg-blue-600 text-white border-blue-600`;
const btnDisabled =
  `${btnBase} opacity-40 cursor-not-allowed text-gray-400 dark:text-gray-500`;

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const start = pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const end = pageSize && totalItems ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {start && end && totalItems && (
          <span>
            Hiển thị <span className="font-medium text-gray-700 dark:text-gray-300">{start}–{end}</span> / <span className="font-medium text-gray-700 dark:text-gray-300">{totalItems}</span> kết quả
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={currentPage === 1 ? btnDisabled : btnNormal}
        >
          ‹
        </button>

        {pageNumbers.map((p, idx) =>
          p === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 py-1 text-sm text-gray-400 dark:text-gray-500 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={p === currentPage ? btnActive : btnNormal}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={currentPage === totalPages ? btnDisabled : btnNormal}
        >
          ›
        </button>
      </div>
    </div>
  );
}
