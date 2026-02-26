"use client";

import React from 'react';
import Input from '../ui/Input';

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
}

export default function FilterBar({ searchValue, onSearchChange, searchPlaceholder = 'Tìm kiếm...', filters }: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 max-w-md">
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {filters && <div className="flex items-center gap-2">{filters}</div>}
    </div>
  );
}

