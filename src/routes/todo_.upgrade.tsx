import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/how2getrich/PageLayout";
import { RightRailWithMoreInfo } from "./todo";

export const Route = createFileRoute("/todo_/upgrade")({
  head: () => ({
    meta: [
      { title: "Unlock Full Plan — how2getrich.online" },
      {
        name: "description",
        content: "Unlock the full how2getrich plan.",
      },
    ],
  }),
  component: TodoPaywall,
});

/**
 * Screen 3 — paywall. A single white card with "Unlock Full Plan"
 * headline and two stacked tier blocks (Basic / Premium), each with
 * its own label, optional description, and price line.
 *
 * Two-tier structure:
 *   - Basic Plan — $9.99 / month
 *   - Premium Plan — short description + $19.99 / month
 *
 * Wiring to Stripe is still a TODO — clicking either tier currently
 * fires a placeholder alert.
 */
const FONT_STACK =
  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace';

type Tier = {
  name: string;
  description?: string;
  price: string;
};

const TIERS: Tier[] = [
  { name: "Basic Plan", price: "$9.99 a month" },
  {
    name: "Premium Plan",
    description: "Plan dscription lorem ipsum",
    price: "$19.99 a month",
  },
];

function TodoPaywall() {
  return (
    <PageLayout rightRail={<RightRailWithMoreInfo />}>
      <h1
        className="text-[22px] leading-tight text-white"
        style={{ fontFamily: FONT_STACK }}
      >
        To Do:
      </h1>

      <div className="mt-[28px] flex w-full justify-center">
        <div
          className="flex w-[437px] max-w-full flex-col items-center rounded-2xl bg-white px-[36px] pt-[40px] pb-[56px] text-black"
          style={{ fontFamily: FONT_STACK }}
        >
          {/* Card title — centered, lighter weight, generous spacing
              below before the tier blocks. */}
          <h2 className="w-full text-center text-[24px] leading-none text-black/85">
            Unlock Full Plan
          </h2>

          {/* Tier blocks. Left-aligned within the card. */}
          <ul className="mt-[52px] flex w-full flex-col gap-[52px]">
            {TIERS.map((tier) => (
              <li key={tier.name}>
                <TierBlock tier={tier} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageLayout>
  );
}

/**
 * A single tier block — name, optional description, price.
 * Clicking the block fires the placeholder alert until Stripe is wired.
 */
function TierBlock({ tier }: { tier: Tier }) {
  return (
    <button
      type="button"
      onClick={() => {
        // TODO: wire to Stripe checkout once pricing IDs are set up.
        window.alert(`${tier.name} — checkout not wired yet.`);
      }}
      className="group block w-full cursor-pointer text-center transition hover:opacity-80 focus:outline-none focus-visible:underline"
    >
      <div className="text-[15px] leading-snug text-black/85">
        {tier.name}
      </div>
      {tier.description && (
        <div className="mx-auto mt-[8px] max-w-[280px] text-[14px] leading-snug text-black/55">
          {tier.description}
        </div>
      )}
      <div className="mt-[8px] text-[14px] leading-snug text-black/85">
        {tier.price}
      </div>
    </button>
  );
}
