"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Role } from "@navex/contracts";
import { marquerTourTermine } from "@/lib/api-client";
import { TOUR_STEPS, type TourStep } from "@/lib/tour-steps";

interface Props {
  role: Role;
  onComplete: () => void;
}

export function GuidedTour({ role, onComplete }: Props) {
  const t = useTranslations("tour");
  const locale = useLocale();
  const rtl = locale === "ar";

  const steps = TOUR_STEPS[role] ?? [];
  const [etape, setEtape] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [confettis, setConfettis] = useState(false);
  const bulleRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);

  const step: TourStep | undefined = steps[etape];
  const total = steps.length;
  const pct = total > 0 ? ((etape + 1) / total) * 100 : 0;

  const calculerPosition = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) { setPos(null); return; }
    const r = el.getBoundingClientRect();
    setPos({ top: r.top + r.height / 2, left: r.left + r.width / 2 });
  }, [step]);

  useEffect(() => {
    calculerPosition();
    window.addEventListener("resize", calculerPosition);
    window.addEventListener("scroll", calculerPosition, true);
    return () => {
      window.removeEventListener("resize", calculerPosition);
      window.removeEventListener("scroll", calculerPosition, true);
    };
  }, [calculerPosition]);

  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [step]);

  function terminer() {
    setConfettis(true);
    marquerTourTermine().catch(() => undefined);
    setTimeout(() => { setConfettis(false); onComplete(); }, 1200);
  }

  function passer() {
    marquerTourTermine().catch(() => undefined);
    onComplete();
  }

  function suivant() {
    if (etape < total - 1) setEtape(etape + 1);
    else terminer();
  }

  if (!step || !pos) return null;

  const decaleX = rtl ? -220 : 220;
  const bulleLeft = Math.max(16, Math.min(pos.left + decaleX, window.innerWidth - 340));
  const bulleTop = Math.max(80, Math.min(pos.top - 60, window.innerHeight - 260));

  const mascotteLeft = rtl ? pos.left + 50 : pos.left - 70;
  const mascotteTop = pos.top - 90;

  return (
    <div className="fixed inset-0 z-[100]" onClick={passer} role="dialog" aria-label={t("etape", { current: etape + 1, total })}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Anneau pulsant */}
      <div
        ref={ringRef}
        className="pointer-events-none absolute z-[101]"
        style={{ top: pos.top - 28, left: pos.left - 28, width: 56, height: 56 }}
      >
        <div className="h-full w-full animate-ping rounded-full border-2 border-navex-red/60" style={{ animationDuration: "1.5s" }} />
        <div className="absolute inset-1 rounded-full border-2 border-navex-red" />
      </div>

      {/* Mascotte SVG */}
      <div
        ref={mascotRef}
        className="pointer-events-none absolute z-[102] transition-all duration-500"
        style={{
          top: mascotteTop,
          left: mascotteLeft,
          transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <svg width="60" height="72" viewBox="0 0 60 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Corps (carton) */}
          <rect x="10" y="18" width="40" height="44" rx="8" fill="#C81E1E" />
          <rect x="12" y="20" width="36" height="40" rx="6" fill="#FBE4E4" />
          {/* Visage */}
          <circle cx="23" cy="36" r="3" fill="#0A0A0A" />
          <circle cx="37" cy="36" r="3" fill="#0A0A0A" />
          <circle cx="24" cy="35" r="1" fill="white" />
          <circle cx="38" cy="35" r="1" fill="white" />
          {/* Sourire */}
          <path d="M24 44 Q30 50 36 44" stroke="#C81E1E" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Chapeau */}
          <rect x="14" y="10" width="32" height="10" rx="4" fill="#C81E1E" />
          <rect x="18" y="6" width="24" height="8" rx="3" fill="#7F1414" />
          <circle cx="30" cy="10" r="2" fill="white" />
          {/* Bras gauche */}
          <rect x="2" y="28" width="10" height="6" rx="3" fill="#C81E1E" />
          <circle cx="4" cy="31" r="4" fill="#FBE4E4" />
          {/* Bras droit */}
          <rect x="48" y="28" width="10" height="6" rx="3" fill="#C81E1E" />
          <circle cx="56" cy="31" r="4" fill="#FBE4E4" />
          {/* Jambe gauche */}
          <rect x="18" y="60" width="8" height="10" rx="4" fill="#C81E1E" />
          <circle cx="22" cy="70" r="5" fill="#7F1414" />
          {/* Jambe droite */}
          <rect x="34" y="60" width="8" height="10" rx="4" fill="#C81E1E" />
          <circle cx="38" cy="70" r="5" fill="#7F1414" />
          {/* Index pointant */}
          <path d={rtl ? "M8 28 L0 20" : "M52 28 L60 20"} stroke="#FBE4E4" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Bulle */}
      <div
        ref={bulleRef}
        className="pointer-events-auto absolute z-[103] w-[300px] rounded-[20px_20px_20px_4px] bg-white p-5 shadow-xl animate-slide-up"
        style={{
          top: bulleTop,
          left: bulleLeft,
          transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Badge icône */}
        <div className="mb-3 flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-navex-red-soft text-sm text-navex-red-dark">
            <TablerIcon name={step.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-navex-ink leading-tight">{t(step.titleKey)}</p>
            <p className="mt-0.5 text-[10px] text-neutral-400" dir="ltr">{t("etape", { current: etape + 1, total })}</p>
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 text-xs leading-relaxed text-neutral-600">{t(step.descKey)}</p>

        {/* Barre de progression */}
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-navex-stone">
          <div
            className="h-full rounded-full bg-navex-red transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Boutons */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={passer} className="text-xs font-medium text-neutral-400 hover:text-navex-ink transition-colors">
            {t("passer")}
          </button>
          <button
            onClick={suivant}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-navex-red px-4 py-1.5 text-xs font-semibold text-white shadow-glow-red hover:bg-navex-red-dark transition-colors"
          >
            {etape < total - 1 ? t("suivant") : t("terminer")}
          </button>
        </div>
      </div>

      {/* Confettis */}
      {confettis && <Confettis />}
    </div>
  );
}

/** Icône Tabler simplifiée (SVG inline) */
function TablerIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    list: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
    plus: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
    package: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>,
    "list-check": <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    "circle-check": <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>,
    "file-text": <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
    scan: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM6.75 15.75h.008v.008H6.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm11.25-7.5h.008v.008h-.008v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 7.5a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
    "package-check": <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12l-9.5-5.5L3 12m18 0l-9 5.25V21" /></svg>,
    "map-pin": <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
    "chart-bar": <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
    users: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 015 17.119V5a2 2 0 012-2h6" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    table: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.375" /></svg>,
  };
  return icons[name] ?? icons.list;
}

/** Confettis — petite animation d'icônes qui s'éparpillent */
function Confettis() {
  const items = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    emoji: ["🎉", "✅", "📦", "🚚", "⭐", "🎊"][i % 6],
    x: (Math.random() - 0.5) * 600,
    y: -(Math.random() * 400 + 100),
    r: Math.random() * 360,
    d: Math.random() * 0.4 + 0.6,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center">
      {items.map((it) => (
        <span
          key={it.id}
          className="absolute text-2xl"
          style={{
            animation: `confetti-fall ${it.d}s ease-out forwards`,
            "--tx": `${it.x}px`,
            "--ty": `${it.y}px`,
            "--tr": `${it.r}deg`,
          } as React.CSSProperties}
        >
          {it.emoji}
        </span>
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--tr)) scale(0.3); }
        }
      `}</style>
    </div>
  );
}
