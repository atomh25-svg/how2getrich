import { createFileRoute, Link } from "@tanstack/react-router";
import { PageLayout } from "@/components/how2getrich/PageLayout";
import { Wordmark } from "@/components/how2getrich/Wordmark";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — how2getrich.online" },
      {
        name: "description",
        content:
          "how2getrich.online is an AI-built 30-day plan that turns 'I want to make money' into a real list of things to do today.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <PageLayout>
      <Wordmark />
      <div
        className="mt-[48px] ml-[8px] flex w-full max-w-[420px] flex-col items-center gap-[14px] text-white/85"
        style={{
          fontFamily:
            '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
        }}
      >
        <h2 className="text-[20px] leading-tight text-white">about</h2>
        <p className="mt-[6px] text-[15px] leading-snug text-white/75">
          how2getrich.online takes one sentence about you and hands you a
          tailored 30-day plan to actually start making money — built by
          AI, grounded in real tools (Stripe, Carrd, ConvertKit, real
          subreddits), and free for the first 10 days.
        </p>
        <p className="mt-[8px] text-[15px] leading-snug text-white/75">
          Unlock the full plan for $9.99/month: continue past day 10, get
          all 30 days of month 1, and scroll for month 2, 3, and beyond.
          Cancel anytime.
        </p>
        <p className="mt-[8px] text-[13px] leading-snug text-white/50">
          We name the domain on purpose. The point isn&apos;t to sell you
          another guru course — it&apos;s to skip the noise and just give
          you the plan.
        </p>
        <div className="mt-[24px] flex w-full justify-center">
          <Link
            to="/"
            className="text-[14px] text-white/55 transition hover:text-white"
          >
            ← start from the home page
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
