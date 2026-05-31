import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageLayout } from "@/components/how2getrich/PageLayout";
import { Wordmark } from "@/components/how2getrich/Wordmark";
import { getH2GRDayDetail } from "@/lib/h2gr-plan";

// Inline type so this route doesn't pull the server-side
// ideas-generator module into the client bundle.
type DayDetail = {
  day_number: number;
  headline: string;
  why: string;
  steps: string[];
  example: string;
  if_stuck: string;
  // Premium-only — undefined for free/basic.
  pitfalls?: string[];
  tools?: string[];
};

export const Route = createFileRoute("/todo_/$day")({
  head: () => ({
    meta: [
      { title: "Day detail — how2getrich.online" },
      { name: "description", content: "Today's tailored breakdown." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    s: typeof search.s === "string" ? search.s : "",
    month:
      typeof search.month === "number"
        ? Math.max(1, Math.min(12, Math.round(search.month)))
        : typeof search.month === "string" && /^\d+$/.test(search.month)
          ? Math.max(1, Math.min(12, parseInt(search.month, 10)))
          : 1,
  }),
  parseParams: (params) => ({
    day: String(params.day),
  }),
  component: DayDetailPage,
});

/**
 * Per-day detail screen reached by clicking a row on /todo.
 *
 * Loads the day's expanded breakdown (headline, why, 3-5 micro-steps,
 * personalized example, if_stuck hint) from D1, regenerating via
 * Claude on first click and caching forever after.
 *
 * URL shape: /todo/$day?s={sessionId}  (e.g. /todo/3?s=abc-123)
 */
function DayDetailPage() {
  const { day } = Route.useParams();
  const { s: sessionId, month } = Route.useSearch();
  const dayNumber = Math.max(1, Math.min(7, parseInt(day, 10) || 1));

  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let sid = sessionId;
    if (!sid) {
      try {
        sid = window.localStorage.getItem("h2gr:sessionId") ?? "";
      } catch {
        /* private mode */
      }
    }
    if (!sid) {
      setError("No session — head back to the homepage and start over.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await getH2GRDayDetail({
          data: { sessionId: sid, dayNumber, month },
        });
        if (cancelled) return;
        if (res.ok) {
          setDetail(res.detail);
        } else {
          setError(`Couldn't load this day (${res.reason}).`);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[todo/$day] fetch failed", err);
        setError("Couldn't reach the detail generator.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, dayNumber]);

  return (
    <PageLayout>
      {loading ? (
        <>
          <Wordmark />
          <div
            className="mt-[64px] flex w-full max-w-[420px] flex-col items-center gap-[14px]"
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            <span className="text-[15px] tracking-wide text-white/70">
              loading day {dayNumber}…
            </span>
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[35%] animate-h2gr-loader rounded-full bg-white/85" />
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className="mt-[18px] flex w-full max-w-[540px] flex-col gap-[6px]"
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            <Link
              to="/todo"
              search={{ s: sessionId, month }}
              className="text-[13px] text-white/45 transition hover:text-white/75"
            >
              ← back to plan
            </Link>
            <h1 className="mt-[12px] text-[22px] leading-tight text-white">
              day {dayNumber}: {detail?.headline ?? "—"}
            </h1>
          </div>

          {error && (
            <p
              className="mt-[12px] text-[14px] text-white/40"
              style={{
                fontFamily:
                  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
              }}
            >
              {error}
            </p>
          )}

          {detail && (
            <div
              className="mt-[24px] flex w-full max-w-[540px] flex-col gap-[24px] text-white/90"
              style={{
                fontFamily:
                  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
              }}
            >
              <Section label="why today">
                <p className="text-[15px] leading-snug text-white/85">
                  {detail.why}
                </p>
              </Section>

              <Section label="steps">
                <ol className="flex flex-col gap-[14px]">
                  {detail.steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex items-baseline gap-[10px] leading-snug"
                    >
                      <span className="w-[18px] shrink-0 text-[13.5px] text-white/55">
                        {i + 1}.
                      </span>
                      <span className="flex-1 text-[14.5px] text-white">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section label="example for you">
                <p className="text-[14.5px] leading-snug text-white/80">
                  {detail.example}
                </p>
              </Section>

              <Section label="if you get stuck">
                <p className="text-[14.5px] leading-snug text-white/80">
                  {detail.if_stuck}
                </p>
              </Section>

              {/* Premium-only sections. Quietly absent for free/basic
                  so the section doesn't render an empty header. */}
              {detail.pitfalls && detail.pitfalls.length > 0 && (
                <Section label="common pitfalls">
                  <ul className="flex flex-col gap-[10px]">
                    {detail.pitfalls.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-baseline gap-[10px] text-[14.5px] leading-snug text-white/80"
                      >
                        <span className="text-white/35">!</span>
                        <span className="flex-1">{p}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {detail.tools && detail.tools.length > 0 && (
                <Section label="tools to use">
                  <ul className="flex flex-col gap-[8px]">
                    {detail.tools.map((t, i) => (
                      <li
                        key={i}
                        className="text-[14.5px] leading-snug text-white/80"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}

          <div className="mt-[40px] flex w-full max-w-[540px] justify-between">
            <DayNav
              dayNumber={dayNumber - 1}
              sessionId={sessionId}
              month={month}
              label="← prev day"
              enabled={dayNumber > 1}
            />
            <DayNav
              dayNumber={dayNumber + 1}
              sessionId={sessionId}
              month={month}
              label="next day →"
              enabled={dayNumber < 7}
            />
          </div>
        </>
      )}
    </PageLayout>
  );
}

/** Labeled block — dim label above, content below. */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-[12px] uppercase tracking-[0.18em] text-white/40">
        {label}
      </span>
      {children}
    </div>
  );
}

function DayNav({
  dayNumber,
  sessionId,
  month,
  label,
  enabled,
}: {
  dayNumber: number;
  sessionId: string;
  month: number;
  label: string;
  enabled: boolean;
}) {
  if (!enabled) {
    return (
      <span
        className="text-[11px] text-white/20"
        style={{
          fontFamily:
            '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      to="/todo/$day"
      params={{ day: String(dayNumber) }}
      search={{ s: sessionId, month }}
      className="text-[13px] text-white/55 transition hover:text-white"
      style={{
        fontFamily:
          '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
      }}
    >
      {label}
    </Link>
  );
}
