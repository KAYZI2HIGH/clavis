import Link from "next/link";
import { MarketingShell } from "@/components/layouts/marketing-shell";
import { KeyIcon } from "@/components/shared/key-icon";

function SectionLabel({ children }: { children: string }) {
  return <p className="engraved text-ink-faint text-center">{children}</p>;
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="serif text-3xl sm:text-4xl text-ink mt-3 leading-tight text-center max-w-3xl text-pretty mx-auto">
      {children}
    </h2>
  );
}

export default function WelcomePage() {
  return (
    <MarketingShell>
      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-20 flex flex-col items-center text-center">
        <p className="engraved text-ink-faint tracking-widest">
          BUILT FOR NIGERIAN BUSINESS PARTNERSHIPS
        </p>
        <h1 className="serif text-4xl sm:text-5xl md:text-6xl text-ink mt-5 leading-tight max-w-3xl">
          A vault that opens only when its partners agree.
        </h1>
        <p className="text-base sm:text-lg text-ink-muted mt-6 max-w-xl leading-relaxed">
          Clavis is a shared business account for co-founders and business partners.
          Pool funds, request payouts, and move money — but only when your team
          turns their keys together.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/sign-up" className="btn-mech btn-mech-primary min-w-[180px] text-center">
            Create a Vault
          </Link>
          <Link href="/sign-in" className="btn-mech btn-mech-ghost min-w-[180px] text-center">
            Sign In
          </Link>
        </div>
        <p className="engraved text-ink-faint mt-10 text-xs">
          Powered by Nomba · Real Nigerian bank accounts · No single partner can act alone
        </p>
      </section>

      {/* ── The Problem ── */}
      <section className="border-t hairline">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <p className="engraved text-ink-faint text-center">THE PROBLEM</p>
          <SectionHeading>
            One person holds the account. Everyone else sends WhatsApp voice notes.
          </SectionHeading>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="border hairline-strong bg-card p-6">
              <p className="engraved text-ink mb-3">UNAUTHORIZED SPENDING</p>
              <p className="text-sm text-ink-muted leading-relaxed">
                A single partner can drain a shared account in seconds. No approval
                needed. No trail left behind.
              </p>
            </div>
            <div className="border hairline-strong bg-card p-6">
              <p className="engraved text-ink mb-3">NO AUDIT TRAIL</p>
              <p className="text-sm text-ink-muted leading-relaxed">
                WhatsApp messages aren&apos;t receipts. When money goes missing,
                there&apos;s no record of who approved what.
              </p>
            </div>
            <div className="border hairline-strong bg-card p-6">
              <p className="engraved text-ink mb-3">BROKEN TRUST</p>
              <p className="text-sm text-ink-muted leading-relaxed">
                Business partnerships collapse not from bad ideas but from bad
                financial controls. Trust is hard to rebuild.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section className="border-t hairline">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <p className="engraved text-ink-faint text-center">HOW CLAVIS WORKS</p>
          <SectionHeading>Three steps. One shared vault.</SectionHeading>
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-12">
            {[
              {
                num: "01",
                title: "Found a vault",
                text: "Create a shared vault, invite your partners, and set how many keys are needed to approve a payout.",
              },
              {
                num: "02",
                title: "Pool funds",
                text: "Your vault gets a real Nigerian bank account number. Partners transfer in from any bank. Balance updates in real time.",
              },
              {
                num: "03",
                title: "Approve together",
                text: "Anyone can request a payout. But funds don't move until the required number of partners turn their keys.",
              },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <p
                  className="serif text-5xl sm:text-6xl text-brass tracking-tight leading-none"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {step.num}
                </p>
                <p className="serif text-xl text-ink mt-5">{step.title}</p>
                <p className="text-sm text-ink-muted mt-3 leading-relaxed max-w-xs mx-auto">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-t hairline">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <p className="engraved text-ink-faint text-center">BUILT WITH DEPTH</p>
          <SectionHeading>Not a workaround. A real financial tool.</SectionHeading>
          <div className="mt-14 max-w-3xl mx-auto divide-y hairline border-t hairline">
            {[
              "Real Nomba Virtual Account — a genuine NUBAN your partners can transfer to from any Nigerian bank",
              "Multi-signatory approvals — quorum-based, every decision logged immutably",
              "Real-time updates — balance and transactions sync instantly across all partners",
              "Full audit trail — every approval, every decline, every transfer — permanently recorded",
              "Nightly reconciliation — automatic drift detection against Nomba's transaction history",
              "Secure by design — no single point of failure, anon writes blocked at database level",
            ].map((text, i) => (
              <div
                key={i}
                className="flex items-start gap-4 px-4 sm:px-0 py-5"
              >
                <div className="mt-0.5 shrink-0">
                  <KeyIcon filled />
                </div>
                <p className="text-sm text-ink leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t hairline">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-24 sm:py-32 flex flex-col items-center text-center">
          <h2 className="serif text-3xl sm:text-4xl text-ink leading-tight">
            Your partners are waiting.
          </h2>
          <p className="text-base sm:text-lg text-ink-muted mt-4 max-w-md">
            Create your vault in minutes. The first key is yours.
          </p>
          <Link
            href="/sign-up"
            className="btn-mech btn-mech-primary min-w-[220px] text-center mt-10"
          >
            Create a Vault
          </Link>
          <p className="engraved text-ink-faint mt-8 text-xs">
            Free to use · Built on Nomba · Made in Nigeria
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}