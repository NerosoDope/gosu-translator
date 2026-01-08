/**
 * Component: AppSidebar
 * Purpose:
 *   - Main navigation sidebar for portal
 *   - Display menu items based on user permissions
 *   - Support collapse/expand and mobile responsive
 *   - Hierarchical menu structure with sections
 *
 * Responsibilities:
 * - Render navigation menu items organized by sections
 * - Highlight active route
 * - Handle sidebar state (expanded/collapsed, mobile open/closed)
 * - Support submenu expansion with auto-open on route match
 *
 * Important:
 * - Menu items are organized into sections (TỔNG QUAN, QUẢN TRỊ NGƯỜI DÙNG, HỆ THỐNG)
 * - Active route detection uses pathname matching
 * - Mobile sidebar is controlled via SidebarContext
 * - Submenu automatically opens when pathname matches submenu item
 *
 * See also:
 * - src/context/SidebarContext.tsx for sidebar state management
 * - docs/architecture.md for layout structure
 */
"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { usePermissions } from "@/lib/rbac";

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; permission?: string }[];
  permission?: string;
};

type MenuSection = {
  title: string;
  items: NavItem[];
};

// Icon components
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const HorizontaLDots = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="6" cy="12" r="1.5" />
    <circle cx="18" cy="12" r="1.5" />
  </svg>
);

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { hasPermission, loading } = usePermissions();
  
  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "overview" | "user_management" | "translation" | "system";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // TỔNG QUAN (OVERVIEW)
  const overviewItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ];
    return items;
  }, []);

  // QUẢN TRỊ NGƯỜI DÙNG (USER MANAGEMENT)
  const userManagementItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];
    
    if (!loading) {
      // Add Users menu if user has permission
      if (hasPermission("users:read")) {
        items.push({
          name: "Người dùng",
          path: "/users",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        });
      }

      // Add Roles menu if user has permission
      if (hasPermission("rbac:roles:read")) {
        items.push({
          name: "Vai trò",
          path: "/roles",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
        });
      }

      // Add Permissions menu if user has permission
      if (hasPermission("rbac:permissions:read")) {
        items.push({
          name: "Quyền",
          path: "/permissions",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
        });
      }
    }
    
    return items;
  }, [hasPermission, loading]);

  // QUẢN LÝ DỊCH THUẬT (TRANSLATION MANAGEMENT)
  const translationItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];

      items.push({
        name: "Quản Lý Jobs",
        path: "/jobs",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <path d="M12 11h4"/>
            <path d="M12 16h4"/>
            <path d="M8 11h.01"/>
            <path d="M8 16h.01"/>
          </svg>
        ),
      });
      items.push({
        name: "Quản Lý Cache",
        path: "/cache",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
        ),
      });
      items.push({
        name: "Từ Điển",
        path: "/dictionary",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
      });
      items.push({
        name: "Quản Lý Prompts",
        path: "/prompts",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      });
      items.push({
        name: "Thể Loại Game",
        path: "/game-category",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
      });
      items.push({
        name: "Game Glossary",
        path: "/game-glossary",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <line x1="6" x2="10" y1="11" y2="11"/>
            <line x1="8" x2="8" y1="9" y2="13"/>
            <line x1="15" x2="15.01" y1="12" y2="12"/>
            <line x1="18" x2="18.01" y1="10" y2="10"/>
            <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>
          </svg>
        ),
      });
      items.push({
        name: "Quản Lý Ngôn Ngữ",
        path: "/languages",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h.01M12 8h.01M17 8h.01" />
          </svg>
        ),
      });


    return items;
  }, []);

  // HỆ THỐNG (SYSTEM)
  const systemItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];

    if (!loading) {
      // Add Audit Log menu if user has permission
      if (hasPermission("audit:read")) {
        items.push({
          name: "Audit Log",
          path: "/audit",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        });
      }

      // Add Settings menu if user has permission
      if (hasPermission("settings:read")) {
        items.push({
          name: "Cài đặt",
          path: "/settings",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        });
      }
    }

    return items;
  }, [hasPermission, loading]);

  // Menu sections
  const menuSections: MenuSection[] = useMemo(() => {
    const sections: MenuSection[] = [
      {
        title: "TỔNG QUAN",
        items: overviewItems,
      },
    ];

    if (userManagementItems.length > 0) {
      sections.push({
        title: "QUẢN TRỊ NGƯỜI DÙNG",
        items: userManagementItems,
      });
    }

    if (translationItems.length > 0) {
      sections.push({
        title: "QUẢN LÝ DỊCH THUẬT",
        items: translationItems,
      });
    }

    if (systemItems.length > 0) {
      sections.push({
        title: "HỆ THỐNG",
        items: systemItems,
      });
    }

    return sections;
  }, [overviewItems, userManagementItems, translationItems, systemItems]);

  const isActive = useCallback((path: string) => {
    if (path === pathname) return true;
    // Special handling for /settings path to match /settings and its sub-routes
    if (path === "/settings") {
      return pathname === "/settings" || pathname?.startsWith("/settings/");
    }
    return pathname?.startsWith(path + "/") || pathname === path;
  }, [pathname]);

  const handleSubmenuToggle = (
    index: number,
    menuType: "overview" | "user_management" | "translation" | "system"
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  // Auto-open submenu when pathname matches submenu item
  useEffect(() => {
    let submenuMatched = false;
            const menuConfig = [
              { type: "overview" as const, items: overviewItems },
              { type: "user_management" as const, items: userManagementItems },
              { type: "translation" as const, items: translationItems },
              { type: "system" as const, items: systemItems },
            ];

    menuConfig.forEach(({ type, items }) => {
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            // Check exact match or if pathname starts with subItem path
            if (
              pathname === subItem.path ||
              (subItem.path !== "/settings" && pathname?.startsWith(subItem.path + "/"))
            ) {
              setOpenSubmenu({ type, index });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      // Don't close submenu if current pathname matches parent path
      const allItems = [...overviewItems, ...userManagementItems, ...translationItems, ...systemItems];
      const parentMatch = allItems.some(
        (item) => item.path && (pathname === item.path || pathname?.startsWith(item.path + "/"))
      );
      if (!parentMatch) {
        setOpenSubmenu(null);
      }
    }
  }, [pathname, overviewItems, userManagementItems, translationItems, systemItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "overview" | "user_management" | "translation" | "system"
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <>
              <button
                onClick={() => handleSubmenuToggle(index, menuType)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                } ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
              >
                <span>{nav.icon}</span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <>
                    <span className="flex-1 text-sm font-medium text-left">{nav.name}</span>
                    <ChevronDownIcon
                      className={`w-5 h-5 transition-transform duration-200 ${
                        openSubmenu?.type === menuType && openSubmenu?.index === index
                          ? "rotate-180 text-blue-500"
                          : ""
                      }`}
                    />
                  </>
                )}
              </button>
              {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
                <div
                  ref={(el) => {
                    subMenuRefs.current[`${menuType}-${index}`] = el;
                  }}
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    height:
                      openSubmenu?.type === menuType && openSubmenu?.index === index
                        ? `${subMenuHeight[`${menuType}-${index}`]}px`
                        : "0px",
                  }}
                >
                  <ul className="mt-2 space-y-1 ml-9">
                    {nav.subItems.map((subItem) => (
                      <li key={subItem.name}>
                        <Link
                          href={subItem.path}
                          className={`block px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                            isActive(subItem.path)
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                          }`}
                        >
                          {subItem.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive(nav.path)
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                } ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
              >
                <span>{nav.icon}</span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="text-sm font-medium text-left">{nav.name}</span>
                )}
              </Link>
            )
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex justify-center`}>
        <Link href="/dashboard">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/logo/logo.png"
                alt="GOSU Core"
                width={139}
                height={35}
                unoptimized
              />
              <Image
                className="hidden dark:block"
                src="/logo/logo-dark.png"
                alt="GOSU Core"
                width={139}
                height={35}
                unoptimized
              />
            </>
          ) : (
            <Image
              src="/logo/logo-icon.png"
              alt="GOSU Core"
              width={32}
              height={32}
              unoptimized
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-6">
            {menuSections.map((section) => {
              const menuType =
                section.title === "TỔNG QUAN"
                  ? "overview"
                  : section.title === "QUẢN TRỊ NGƯỜI DÙNG"
                  ? "user_management"
                  : section.title === "QUẢN LÝ DỊCH THUẬT"
                  ? "translation"
                  : "system";

              return (
                <div key={section.title}>
                  <h2
                    className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                      !isExpanded && !isHovered
                        ? "lg:justify-center"
                        : "justify-start"
                    }`}
                  >
                    {isExpanded || isHovered || isMobileOpen ? (
                      section.title
                    ) : (
                      <HorizontaLDots className="w-4 h-4" />
                    )}
                  </h2>
                  {renderMenuItems(section.items, menuType)}
                </div>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
