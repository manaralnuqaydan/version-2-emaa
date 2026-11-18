import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Camera, Home, MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BrandLogo } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageControls";

const NAV = [
  { to: "/home", key: "nav.home", Icon: Home },
  { to: "/chat", key: "nav.assistant", Icon: MessageCircle },
  { to: "/camera", key: "nav.live", Icon: Camera },
] as const;

// الإطار المشترك لكل الشاشات: شعار + تنقل + اللغة فوق، وشريط سفلي على الجوال
export function AppShell({
  children,
  actions,
  fullHeight = false,
}: {
  children: ReactNode;
  /** أزرار خاصة بالشاشة تظهر جنب اختيار اللغة */
  actions?: ReactNode;
  /** الشاشة تملأ ارتفاع الشاشة على اللابتوب (المساعد والكاميرا) */
  fullHeight?: boolean;
}) {
  const { t, dir } = useI18n();
  const { pathname } = useLocation();
  return (
    <div
      dir={dir}
      className={`relative flex min-h-dvh w-full flex-col text-foreground ${fullHeight ? "lg:h-dvh lg:overflow-hidden" : ""}`}
    >
      <header className="sticky top-0 z-40 shrink-0 border-b border-white/[0.06] bg-[oklch(0.12_0.03_288/0.72)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <BrandLogo />
          <nav
            aria-label={t("nav.label")}
            className="mx-auto hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1 md:flex"
          >
            {NAV.map(({ to, key, Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-all ${active ? "grad-purple text-white shadow-soft" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  {t(key)}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-2 md:ms-0">
            {actions && <div className="hidden items-center gap-2 lg:flex">{actions}</div>}
            <LanguageSwitcher dark />
          </div>
        </div>
        {actions && (
          <div className="flex items-center justify-center gap-2 border-t border-white/[0.05] px-4 py-2 lg:hidden">
            {actions}
          </div>
        )}
      </header>

      <div
        className={`relative flex flex-1 flex-col pb-24 md:pb-0 ${fullHeight ? "lg:min-h-0" : ""}`}
      >
        {children}
      </div>

      {/* شريط سفلي للجوال */}
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 gap-1 rounded-[22px] border border-white/10 bg-[oklch(0.16_0.04_290/0.85)] p-1.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl md:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map(({ to, key, Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition-all ${active ? "grad-purple text-white shadow-soft" : "text-white/55"}`}
            >
              <Icon className="h-5 w-5" />
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
