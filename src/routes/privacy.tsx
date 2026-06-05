import { createFileRoute, Link } from "@tanstack/react-router";
import { PageLayout } from "@/components/how2getrich/PageLayout";
import { Wordmark } from "@/components/how2getrich/Wordmark";
import privacyHtml from "../content/privacy-policy.html?raw";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — how2getrich.online" },
      {
        name: "description",
        content:
          "How how2getrich.online collects, uses, stores, and shares your personal information.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PageLayout>
      <Wordmark />
      <div
        className="privacy-doc mt-[40px] w-full max-w-[640px] rounded-[6px] border border-white/15 bg-white/[0.04] p-[28px] text-white/85"
        dangerouslySetInnerHTML={{ __html: privacyHtml }}
      />
      <div className="mt-[24px] flex w-full justify-center">
        <Link
          to="/"
          className="text-[13px] text-white/55 transition hover:text-white"
        >
          ← back to how2getrich.online
        </Link>
      </div>

      {/* Scoped CSS overrides for Termly's light-theme inline colors */}
      <style>{`
        .privacy-doc [data-custom-class='body'],
        .privacy-doc [data-custom-class='body'] * {
          background: transparent !important;
        }
        .privacy-doc [data-custom-class='title'],
        .privacy-doc [data-custom-class='title'] *,
        .privacy-doc h1, .privacy-doc h2, .privacy-doc h3 {
          font-family: inherit !important;
          color: rgb(245, 245, 245) !important;
        }
        .privacy-doc [data-custom-class='subtitle'],
        .privacy-doc [data-custom-class='subtitle'] * {
          font-family: inherit !important;
          color: rgb(170, 170, 170) !important;
        }
        .privacy-doc [data-custom-class='heading_1'],
        .privacy-doc [data-custom-class='heading_1'] * {
          font-family: inherit !important;
          color: rgb(120, 220, 130) !important;
          font-size: 1.4rem !important;
          margin-top: 2rem !important;
          margin-bottom: 0.5rem !important;
        }
        .privacy-doc [data-custom-class='heading_2'],
        .privacy-doc [data-custom-class='heading_2'] * {
          font-family: inherit !important;
          color: rgb(245, 245, 245) !important;
          font-size: 1.05rem !important;
          margin-top: 1.5rem !important;
          margin-bottom: 0.4rem !important;
        }
        .privacy-doc [data-custom-class='body_text'],
        .privacy-doc [data-custom-class='body_text'] *,
        .privacy-doc p, .privacy-doc li, .privacy-doc span {
          color: rgb(200, 200, 200) !important;
          font-family: inherit !important;
          font-size: 0.875rem !important;
          line-height: 1.65 !important;
        }
        .privacy-doc [data-custom-class='link'],
        .privacy-doc [data-custom-class='link'] *,
        .privacy-doc a {
          color: rgb(120, 220, 130) !important;
          text-decoration: underline !important;
          text-underline-offset: 2px !important;
        }
        .privacy-doc table { border-collapse: collapse !important; margin: 1rem 0 !important; width: 100% !important; }
        .privacy-doc table td, .privacy-doc table th { border: 1px solid rgba(120, 220, 130, 0.2) !important; padding: 0.5rem 0.75rem !important; vertical-align: top !important; }
        .privacy-doc ul { padding-left: 1.5rem !important; margin: 0.5rem 0 !important; }
        .privacy-doc li { margin: 0.3rem 0 !important; }
      `}</style>
    </PageLayout>
  );
}
