import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HostNotificationsProvider from "@/components/HostNotificationsProvider";
import AnalyticsLoader from "@/components/analytics/AnalyticsLoader";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";

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
        <AnalyticsTracker />
        <HostNotificationsProvider hostUserId={user?.id ?? null}>
          <div className="flex min-h-screen flex-col">
            <SiteHeader user={user} isAdmin={isAdmin} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </HostNotificationsProvider>
      </body>
    </html>
  );
}

