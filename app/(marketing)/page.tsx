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
          TRANSPARENT INVESTMENT VEHICLES
        </p>
        <h1 className="serif text-4xl sm:text-5xl md:text-6xl text-ink mt-5 leading-tight max-w-3xl">
          Run investment syndicates with absolute transparency.
        </h1>
        <p className="text-base sm:text-lg text-ink-muted mt-6 max-w-xl leading-relaxed">
          Clavis is the operating system for Nigerian investment vehicles. Pool capital, 
          automatically classify revenue, and execute profit settlements—all with built-in multi-party approval.
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
          Powered by Monnify · Real Nigerian bank accounts · Automated Profit Sharing
        </p>
      </section>

      {/* ── The Problem ── */}
      <section className="border-t hairline">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <p className="engraved text-ink-faint text-center">THE PROBLEM</p>
          <SectionHeading>
            Managing pooled capital shouldn't rely on trust and spreadsheets.
          </SectionHeading>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="border hairline-strong bg-card p-6">
              <p className="engraved text-ink mb-3">BLIND SPOTS</p>
              <p className="text-sm text-ink-muted leading-relaxed">
                Investors send capital but have no visibility into how revenue is performing in real time. They only see what operators choose to report.
              </p>
            </div>
            <div className="border hairline-strong bg-card p-6">
              <p className="engraved text-ink mb-3">MESSY SETTLEMENTS</p>
              <p className="text-sm text-ink-muted leading-relaxed">
                Operators spend hours manually calculating profit shares, capital deductions, and sending individual payouts to investors.
              </p>
            </div>
            <div className="border hairline-strong bg-card p-6">
              <p className="engraved text-ink mb-3">BROKEN TRUST</p>
              <p className="text-sm text-ink-muted leading-relaxed">
                Lack of predefined rules and transparent ledgers causes friction between capital providers and operators. Trust is hard to rebuild.
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
                title: "Define the rules",
                text: "Create a vault, define your investment terms (e.g., 60/40 profit split), and invite your investors to join the syndicate.",
              },
              {
                num: "02",
                title: "Pool & Track",
                text: "Your vault gets a real Monnify virtual account. Capital flows in, and ongoing business revenue is automatically tracked.",
              },
              {
                num: "03",
                title: "Run Settlements",
                text: "Execute one-click settlements that automatically calculate the profit pool and disburse funds directly to all investors.",
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
              "Real Monnify Virtual Account — a genuine NUBAN your partners can transfer to from any Nigerian bank",
              "Operator & Investor Roles — distinct dashboards with tailored permissions and visibility",
              "Automated Profit Settlements — one-click disbursements calculated against predefined revenue splits",
              "Smart Classifications — distinct tracking for Capital injections vs. Revenue streams",
              "Full audit trail — every approval, every decline, every transfer — permanently recorded",
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
            Raise capital the right way.
          </h2>
          <p className="text-base sm:text-lg text-ink-muted mt-4 max-w-md">
            Create your syndicate in minutes. Establish trust from day one.
          </p>
          <Link
            href="/sign-up"
            className="btn-mech btn-mech-primary min-w-[220px] text-center mt-10"
          >
            Create a Vault
          </Link>
          <p className="engraved text-ink-faint mt-8 text-xs">
            Free to use · Built on Monnify · Made in Nigeria
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}