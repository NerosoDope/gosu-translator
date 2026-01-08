"use client";

import React from 'react';
import Link from 'next/link';

interface DropdownItemProps {
  children: React.ReactNode;
  onItemClick?: () => void;
  tag?: 'a' | 'button';
  href?: string;
  className?: string;
}

export function DropdownItem({
  children,
  onItemClick,
  tag = 'button',
  href,
  className,
}: DropdownItemProps) {
  const handleClick = () => {
    if (onItemClick) {
      onItemClick();
    }
  };

  if (tag === 'a' && href) {
    return (
      <Link href={href} className={className} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}

