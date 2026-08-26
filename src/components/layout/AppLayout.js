"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  BarChart3,
  Bell,
  ChevronRight,
  ClipboardCheck,
  FileCode2,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
  Zap,
} from "lucide-react";

import { read, save } from "../../lib/utils";

import {
  getCurrentUser,
  getNotifications,
  getValidationReports,
} from "../../lib/api";

import { Chatbot } from "../chatbot/Chatbot";

/* =========================================================
   NAVIGATION
========================================================= */

const nav = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Convert Excel", "/convert/select-voucher", FileSpreadsheet],
  ["Templates", "/templates", ClipboardCheck],
  ["Validation Reports", "/validation-reports", ShieldCheck],
  ["Upload History", "/upload-history", History],
  ["XML Files", "/xml-files", FileCode2],
  ["Analytics", "/analytics", BarChart3],
  ["Help & Guide", "/help", Sparkles],
  ["Settings", "/settings", Settings],
];

/* =========================================================
   LOGO
========================================================= */

function Logo() {
  return (
    <Link href="/dashboard" className="app-logo">
      <span>
        <Zap size={16} fill="currentColor" />
      </span>
      Smart Tally <b>XML</b>
    </Link>
  );
}

/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar({ open, close, user, validationReportCount }) {
  const router = useRouter();
  const current = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("currentUser");

    localStorage.removeItem("smartTallyToken");

    localStorage.removeItem("backendUploadId");

    localStorage.removeItem("backendValidationId");

    localStorage.removeItem("backendXmlId");

    router.replace("/login");
  };

  return (
    <aside className={`sidebar ${open ? "drawer-open" : ""}`}>
      <div className="side-top">
        <Logo />

        <button
          className="icon-btn mobile-only"
          onClick={close}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      <span className="side-label">WORKSPACE</span>

      <div className="side-links">
        {nav.map(([name, path, Icon]) => {
          const isCurrent =
            current === path ||
            (name === "Convert Excel" && current.startsWith("/convert"));

          return (
            <Link
              href={path}
              onClick={close}
              className={isCurrent ? "current" : ""}
              key={name}
            >
              <Icon size={17} />

              {name}

              {name === "Validation Reports" && validationReportCount > 0 && (
                <i>
                  {validationReportCount > 99 ? "99+" : validationReportCount}
                </i>
              )}
            </Link>
          );
        })}
      </div>

      <div className="side-bottom">
        <Link href="/profile">
          <span className="avatar">{getInitials(user?.name)}</span>

          <span>
            <b>{user?.name || "User"}</b>

            <small>{user?.role || "Accountant"}</small>
          </span>

          <ChevronRight size={15} />
        </Link>

        <button onClick={handleLogout}>
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </aside>
  );
}

/* =========================================================
   HEADER
========================================================= */

function Header({ onMenu, theme, setTheme }) {
  const [notifications, setNotifications] = useState(false);

  const [items, setItems] = useState([]);

  const currentPath = usePathname();

  const loadNotifications = async () => {
    try {
      const response = await getNotifications();

      const notificationItems =
        response?.items || response?.notifications || [];

      setItems(Array.isArray(notificationItems) ? notificationItems : []);
    } catch {
      setItems([]);
    }
  };

  return (
    <header className="app-header">
      <button
        className="icon-btn mobile-only"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>

      <div className="crumb">
        <span>Workspace</span>

        <ChevronRight size={14} />

        <b>{getPageTitle(currentPath)}</b>
      </div>

      <div className="header-actions">
        <button
          className="icon-btn"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="notification-wrap">
          <button
            className="icon-btn"
            aria-label="Open notifications"
            onClick={() => {
              setNotifications((value) => !value);

              loadNotifications();
            }}
          >
            <Bell size={18} />

            <i className="notification-dot" />
          </button>

          {notifications && (
            <div className="notification-panel">
              <b>Notifications</b>

              {items.length > 0 ? (
                items.map((item) => (
                  <span key={item._id || item.id}>
                    {item.message || item.title || "Notification"}
                  </span>
                ))
              ) : (
                <span>No notifications yet.</span>
              )}
            </div>
          )}
        </div>

        <div className="header-avatar">JS</div>
      </div>
    </header>
  );
}

/* =========================================================
   MAIN APP LAYOUT
========================================================= */

function AppLayout({ children }) {
  const [open, setOpen] = useState(false);

  const [theme, setTheme] = useState(() => read("theme", "light"));

  const [checkingAuth, setCheckingAuth] = useState(true);

  const [user, setUser] = useState(null);

  const [validationReportCount, setValidationReportCount] = useState(0);

  const pathname = usePathname();

  const router = useRouter();

  /* =======================================================
     THEME
  ======================================================= */

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    save("theme", theme);
  }, [theme]);

  /* =======================================================
     AUTHENTICATION
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function checkAuthentication() {
      try {
        const currentUser = await getCurrentUser();

        if (!mounted) {
          return;
        }

        setUser(currentUser);

        setCheckingAuth(false);
      } catch {
        if (!mounted) {
          return;
        }

        setCheckingAuth(false);

        router.replace("/login");
      }
    }

    checkAuthentication();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  /* =======================================================
     REAL VALIDATION REPORT COUNT
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function loadValidationReportCount() {
      try {
        const response = await getValidationReports();

        /*
         * Support common backend response shapes:
         *
         * { items: [] }
         * { reports: [] }
         * { data: { items: [] } }
         * []
         */

        const reports = Array.isArray(response)
          ? response
          : Array.isArray(response?.items)
            ? response.items
            : Array.isArray(response?.reports)
              ? response.reports
              : Array.isArray(response?.data?.items)
                ? response.data.items
                : [];

        if (!mounted) {
          return;
        }

        /*
         * Count actual reports from the backend.
         * No hardcoded number is used.
         */
        setValidationReportCount(reports.length);
      } catch {
        if (!mounted) {
          return;
        }

        /*
         * If reports endpoint is unavailable,
         * don't show a fake count.
         */
        setValidationReportCount(0);
      }
    }

    if (!checkingAuth) {
      loadValidationReportCount();
    }

    return () => {
      mounted = false;
    };
  }, [checkingAuth, pathname]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (checkingAuth) {
    return (
      <div className="route-loading">
        <span className="loading-spinner" />
        Checking workspace access...
      </div>
    );
  }

  /* =======================================================
     LAYOUT
  ======================================================= */

  return (
    <div className="app-shell">
      <Sidebar
        open={open}
        close={() => setOpen(false)}
        user={user}
        validationReportCount={validationReportCount}
      />

      <div className="app-main">
        <Header
          onMenu={() => setOpen(true)}
          theme={theme}
          setTheme={setTheme}
        />

        <main className="workspace">{children}</main>
      </div>

      <Chatbot />
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getInitials(name) {
  if (!name) {
    return "U";
  }

  const parts = String(name).trim().split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getPageTitle(pathname) {
  const title = pathname?.split("/").filter(Boolean).pop() || "dashboard";

  return title
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/* =========================================================
   EXPORTS
========================================================= */

export { Logo, Sidebar, Header, AppLayout };
