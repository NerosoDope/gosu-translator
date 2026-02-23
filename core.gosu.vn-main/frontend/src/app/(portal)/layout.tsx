/**
 * Layout: Portal Layout
 * Purpose:
 *   - Main layout for authenticated portal pages
 *   - Provides header, sidebar, and content area
 *   - Handles authentication guard
 *
 * Responsibilities:
 * - Check authentication status on mount
 * - Redirect to login if not authenticated
 * - Provide context providers (Sidebar, Theme, Toast)
 * - Render AppHeader, AppSidebar, and page content
 *
 * Flow:
 * 1. Check for auth token on mount
 * 2. Verify user via authStore.getCurrentUser()
 * 3. If valid: render portal layout
 * 4. If invalid: redirect to /login
 *
 * Important:
 * - This layout wraps all (portal) route group pages
 * - Auth check happens client-side (can be enhanced with middleware)
 * - Loading state shown during auth verification
 *
 * See also:
 * - src/app/(auth)/login/page.tsx for login flow
 * - docs/architecture.md for routing structure
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authStore } from "@/lib/auth";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const AUTH_TIMEOUT_MS = 15000;

    const checkAuth = async () => {
      const token = authStore.getToken();
      if (!token) {
        setLoading(false);
        router.push("/login");
        return;
      }

      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Auth check timeout")), AUTH_TIMEOUT_MS)
        );
        const user = await Promise.race([
          authStore.getCurrentUser(),
          timeoutPromise,
        ]);
        if (!user) {
          setLoading(false);
          router.push("/login");
          return;
        }
        setLoading(false);
      } catch (error) {
        setLoading(false);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-border text-brand-600" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <SidebarProvider>
        <ToastProvider>
          <PortalLayoutContent>{children}</PortalLayoutContent>
        </ToastProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}

/**
 * PortalLayoutContent - Internal component to access SidebarContext
 * 
 * This component needs to be inside SidebarProvider to access useSidebar hook.
 * It handles dynamic margin-left based on sidebar state.
 */
function PortalLayoutContent({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  // Dynamic class for main content margin based on sidebar state
  // - Mobile: no margin (sidebar overlays)
  // - Desktop expanded/hovered: 290px (full sidebar width)
  // - Desktop collapsed: 90px (collapsed sidebar width)
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}>
        <AppHeader />
        <div className="p-4 mx-auto max-w-7xl md:p-6">{children}</div>
      </div>
    </div>
  );
}
