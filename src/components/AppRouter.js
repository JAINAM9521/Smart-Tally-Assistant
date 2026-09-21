"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "./layout/AppLayout";
import { Auth, ForgotPassword, VerifyEmailPage } from "./auth/AuthPages";
import { Dashboard } from "./dashboard/DashboardPage";
import { Conversion } from "./conversion/ConversionPages";
import { DataPage } from "./data/DataPages";

export default function AppRouter() {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (path === "/convert") router.replace("/convert/select-voucher");
  }, [path, router]);

  if (path.startsWith("/verify-email")) {
    const token = path.replace(/^\/verify-email\/?/, "");
    return <VerifyEmailPage token={token} />;
  }

  if (path === "/login" || path === "/register")
    return <Auth mode={path.slice(1)} />;

  if (path === "/forgot-password" || path === "/reset-password")
    return <ForgotPassword />;

  if (path === "/convert")
    return (
      <div className="route-loading">
        <span className="loading-spinner" />
        Opening conversion...
      </div>
    );

  return (
    <AppLayout>
      {path === "/dashboard" ? (
        <Dashboard />
      ) : path.startsWith("/convert/") ? (
        <Conversion />
      ) : (
        <DataPage type={path} />
      )}
    </AppLayout>
  );
}
