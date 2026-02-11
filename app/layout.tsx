import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import "@/lib/env";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import HeaderShell from "@/components/HeaderShell";
import HostNotificationsProvider from "@/components/HostNotificationsProvider";
import AnalyticsLoader from "@/components/analytics/AnalyticsLoader";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";
import AuthProvider from "@/components/auth/AuthProvider";
import GamertagGate from "@/components/auth/GamertagGate";
import OverlayGlassShell from "@/components/OverlayGlassShell";
import OverlayAutoRefresher from "@/components/OverlayAutoRefresher";
import OverlayVersionLabel from "@/components/OverlayVersionLabel";
import OverlayDiagnostics from "@/components/OverlayDiagnostics";
import { OverlayTelemetryProvider } from "@/components/OverlayTelemetryProvider";
import OverlayWindowControls from "@/components/OverlayWindowControls";
import { NotificationsDrawerProvider } from "@/components/notifications/NotificationsDrawerContext";
import NotificationsDrawer from "@/components/notifications/NotificationsDrawer";

export const metadata: Metadata = {
  title: "Customs on the Ring",
  description:
    "Customs on the Ring coordinates Halo MCC custom game invites with opt-in lobbies and mod metadata.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const isAdmin = isAdminUser(user);

  return (
    <html lang="en">
      <body className="antialiased">
        <AnalyticsLoader />
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
        <OverlayTelemetryProvider>
          <NotificationsDrawerProvider>
            <OverlayGlassShell />
            <OverlayAutoRefresher />
            <OverlayVersionLabel />
            <OverlayDiagnostics />
            <OverlayWindowControls />
            <AuthProvider>
              <Suspense fallback={null}>
                <GamertagGate user={user} />
              </Suspense>
              <HostNotificationsProvider hostUserId={user?.id ?? null}>
                <NotificationsDrawer />
                <div className="relative z-10 flex min-h-screen flex-col">
                  <HeaderShell user={user} isAdmin={isAdmin} />
                  <main className="flex-1">
                    <Suspense fallback={null}>{children}</Suspense>
                  </main>
                </div>
              </HostNotificationsProvider>
            </AuthProvider>
          </NotificationsDrawerProvider>
        </OverlayTelemetryProvider>
      </body>
    </html>
  );
}

