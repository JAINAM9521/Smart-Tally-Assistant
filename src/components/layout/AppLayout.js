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
import { getCurrentUser, getNotifications } from "../../lib/api";
import { Chatbot } from "../chatbot/Chatbot";

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

function Logo() {
  return (
    <Link
      href="/dashboard"
      className="app-logo"
      aria-label="Smart Tally XML Assistant"
    >
      <span>
        <Zap size={16} fill="currentColor" />
      </span>
      Smart Tally <b>XML</b>
    </Link>
  );
}

function Sidebar({ open, close, user }) {
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
          type="button"
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
          const active =
            current === path ||
            (name === "Convert Excel" && current.startsWith("/convert"));

          return (
            <Link
              href={path}
              onClick={close}
              className={active ? "current" : ""}
              key={name}
            >
              <Icon size={17} />

              {name}

              {name === "Validation Reports" && <i>3</i>}
            </Link>
          );
        })}
      </div>

      <div className="side-bottom">
        <Link href="/profile">
          <span className="avatar">
            {user?.name?.slice(0, 2).toUpperCase() || "US"}
          </span>

          <span>
            <b>{user?.name || "User"}</b>

            <small>{user?.role || "Accountant"}</small>
          </span>

          <ChevronRight size={15} />
        </Link>

        <button type="button" onClick={handleLogout}>
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </aside>
  );
}

function Header({ onMenu, theme, setTheme }) {
  const pathname = usePathname();

  const [notifications, setNotifications] = useState(false);

  const [items, setItems] = useState([]);

  const loadNotifications = async () => {
    try {
      const response = await getNotifications();

      setItems(response?.items || []);
    } catch {
      setItems([]);
    }
  };

  const currentPage =
    pathname.split("/").filter(Boolean).pop()?.replaceAll("-", " ") ||
    "dashboard";

  return (
    <header className="app-header">
      <button
        type="button"
        className="icon-btn mobile-only"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>

      <div className="crumb">
        <span>Workspace</span>

        <ChevronRight size={14} />

        <b>{currentPage}</b>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="notification-wrap">
          <button
            type="button"
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
                  <span key={item._id}>
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

function AppLayout({ children }) {
  const [open, setOpen] = useState(false);

  const [theme, setTheme] = useState(() => read("theme", "light"));

  const [checkingAuth, setCheckingAuth] = useState(true);

  const [user, setUser] = useState(null);

  const pathname = usePathname();

  const router = useRouter();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    save("theme", theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    const verifySession = async () => {
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
    };

    verifySession();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (checkingAuth) {
    return (
      <div className="route-loading">
        <span className="loading-spinner" />
        Checking workspace access...
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar open={open} close={() => setOpen(false)} user={user} />

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

export { Logo, Sidebar, Header, AppLayout };
