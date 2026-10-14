import { Suspense } from "react";
import { HeroArt } from "@/components/landing/hero-art";
import { ActiveChallenges, LeaderboardPreview, SectionSkeleton } from "@/components/landing/live-sections";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, H2 } from "@/components/ui/typography";
import { siteConfig } from "@/config/site";

const atAGlance = [
  { k: "Challenges", v: "Published by the Code Sapiens organizers, each with its reward and deadline up front." },
  { k: "Review", v: "Every submission is checked by an organizer before any coins are awarded." },
  { k: "Leaderboard", v: "Approved work earns coins, and your total decides your place on the board." },
];

const coinRules = [
  { title: "Rewards are shown up front", body: "Each challenge lists exactly how many coins it is worth before you start." },
  { title: "Paid on approval", body: "Coins are credited only when an organizer approves your submission — never for a pending one." },
  { title: "Once per challenge", body: "A challenge pays out a single time, however many times a request is repeated." },
  { title: "Rejected? Try again", body: "You see the reviewer's reason and can resubmit while the challenge is still open." },
];

const flow = [
  { step: "Submit", tone: "bg-surface text-ink" },
  { step: "Review", tone: "bg-sky text-on-accent" },
  { step: "+Coins", tone: "bg-mint text-on-accent" },
  { step: "Rank", tone: "bg-pink text-on-accent" },
];

const steps = [
  { title: "Sign in", body: "Create your account or log in with your email." },
  { title: "Explore challenges", body: "Browse open challenges, their rewards, deadlines and requirements." },
  { title: "Complete and submit", body: "Do the work, then submit notes, a link or a private file as proof." },
  { title: "Earn coins after approval", body: "An organizer reviews your attempt; approval credits the reward." },
  { title: "Climb the leaderboard", body: "Your coins earned set your rank among public participants." },
];

export default function Home() {
  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b-[3px] border-ink">
        <div aria-hidden="true" className="bg-lines absolute inset-0" />
        <div aria-hidden="true" className="bg-noise absolute inset-0" />
        <Container className="relative grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.35fr_1fr] lg:items-center lg:py-24">
          <div className="flex flex-col gap-8">
            <p className="w-fit -rotate-1 border-[3px] border-ink bg-surface px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.15em] text-mint shadow-brutal-sm sm:text-xs sm:tracking-[0.3em]">
              {siteConfig.name} · {siteConfig.product}
            </p>
            <h1 className="font-display uppercase leading-[0.86] tracking-tight">
              <span className="block text-3xl text-subtle sm:text-4xl lg:text-5xl">Welcome to the</span>{" "}
              <span className="block text-[3.6rem] sm:text-8xl lg:text-[7.5rem] xl:text-[9rem]">Challenge</span>{" "}
              <span className="mt-2 inline-block -rotate-1 border-[3px] border-ink bg-mint px-3 text-[3.6rem] text-on-accent shadow-brutal-lg sm:text-8xl lg:text-[7.5rem] xl:text-[9rem]">
                Arena
              </span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-subtle sm:text-xl">
              Take on exciting challenges, complete tasks, earn coins, and climb the leaderboard. Every challenge is an
              opportunity to showcase your skills.
            </p>
            <div className="flex flex-wrap gap-4">
              <ButtonLink href="/tasks" size="lg">
                Explore Challenges
              </ButtonLink>
              <ButtonLink href="/leaderboard" size="lg" variant="secondary">
                View Leaderboard
              </ButtonLink>
            </div>
          </div>
          <div className="hidden sm:block">
            <HeroArt />
          </div>
        </Container>
      </section>

      {/* --------------------------------------------------- at a glance */}
      <section aria-label="How the event works" className="border-b-[3px] border-ink bg-surface">
        <Container className="grid divide-y-[3px] divide-ink md:grid-cols-3 md:divide-x-[3px] md:divide-y-0">
          {atAGlance.map((item, i) => (
            <div key={item.k} className="flex gap-4 py-8 md:px-8 md:first:pl-0 md:last:pr-0">
              <span className="font-display text-4xl leading-none text-mint">{i + 1}</span>
              <div className="flex flex-col gap-1">
                <p className="font-display text-2xl uppercase">{item.k}</p>
                <p className="text-sm leading-relaxed text-subtle">{item.v}</p>
              </div>
            </div>
          ))}
        </Container>
      </section>

      {/* --------------------------------------------- active challenges */}
      <section aria-labelledby="active" className="border-b-[3px] border-ink">
        <Container className="flex flex-col gap-10 py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-3">
              <Eyebrow>Open now</Eyebrow>
              <H2 id="active">Active challenges</H2>
            </div>
            <ButtonLink href="/tasks" variant="secondary">
              Explore Challenges
            </ButtonLink>
          </div>
          <Suspense fallback={<SectionSkeleton />}>
            <ActiveChallenges />
          </Suspense>
        </Container>
      </section>

      {/* ------------------------------------------------------- coins */}
      <section aria-labelledby="coins" className="relative overflow-hidden border-b-[3px] border-ink bg-surface">
        <Container className="grid gap-12 py-16 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="flex flex-col gap-6">
            <Eyebrow>Rewards</Eyebrow>
            <H2 id="coins">How coins work</H2>
            <p className="max-w-lg text-subtle">
              Coins are recorded in a ledger, one entry per approved challenge. Your coins earned decide your leaderboard
              position. Coins are virtual points with no cash value.
            </p>
            <ol aria-label="From submission to rank" className="flex flex-wrap items-center gap-2">
              {flow.map((f, i) => (
                <li key={f.step} className="flex items-center gap-2">
                  <span
                    className={`border-[3px] border-ink px-3 py-2 font-display text-xl uppercase shadow-brutal-sm ${f.tone}`}
                  >
                    {f.step}
                  </span>
                  {i < flow.length - 1 && (
                    <span aria-hidden="true" className="font-display text-2xl text-mint">
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <ul className="grid list-none gap-4 sm:grid-cols-2">
            {coinRules.map((rule, i) => (
              <li key={rule.title} className="flex flex-col gap-2 border-[3px] border-ink bg-paper p-5 shadow-brutal">
                <span className="font-mono text-xs font-bold text-mint">RULE {String(i + 1).padStart(2, "0")}</span>
                <span className="text-lg font-bold leading-snug">{rule.title}</span>
                <span className="text-sm leading-relaxed text-subtle">{rule.body}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* -------------------------------------------------- leaderboard */}
      <section aria-labelledby="board" className="border-b-[3px] border-ink">
        <Container className="flex flex-col gap-10 py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-3">
              <Eyebrow>Live standings</Eyebrow>
              <H2 id="board">Leaderboard</H2>
            </div>
            <ButtonLink href="/leaderboard" variant="secondary">
              View Leaderboard
            </ButtonLink>
          </div>
          <Suspense fallback={<SectionSkeleton />}>
            <LeaderboardPreview />
          </Suspense>
        </Container>
      </section>

      {/* ------------------------------------------------ how it works */}
      <section aria-labelledby="how" className="border-b-[3px] border-ink bg-surface">
        <Container className="flex flex-col gap-10 py-16 sm:py-20">
          <div className="flex flex-col gap-3">
            <Eyebrow>Five steps</Eyebrow>
            <H2 id="how">How it works</H2>
          </div>
          <ol className="grid list-none border-[3px] border-ink sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="flex flex-col gap-3 border-b-[3px] border-ink bg-paper p-6 last:border-b-0 sm:[&:nth-child(odd)]:border-r-[3px] lg:border-b-0 lg:border-r-[3px] lg:last:border-r-0"
              >
                <span className="font-display text-6xl leading-none text-outline">{i + 1}</span>
                <span className="text-lg font-bold leading-tight">{s.title}</span>
                <span className="text-sm leading-relaxed text-subtle">{s.body}</span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ------------------------------------------------------ closing */}
      <section aria-labelledby="closing" className="relative overflow-hidden bg-mint text-on-accent">
        <div aria-hidden="true" className="bg-hazard h-3 border-b-[3px] border-on-accent" />
        <Container className="flex flex-col items-start gap-8 py-16 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-2xl flex-col gap-4">
            <p className="font-mono text-sm font-bold uppercase tracking-[0.3em]">{siteConfig.name}</p>
            <h2 id="closing" className="font-display text-5xl uppercase leading-[0.9] sm:text-7xl">
              The arena is open.
            </h2>
            <p className="text-lg">Pick your first challenge, submit your best work and see where you place.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <ButtonLink href="/tasks" size="lg" variant="secondary">
              Explore Challenges
            </ButtonLink>
            <ButtonLink
              href="/signup"
              size="lg"
              className="border-on-accent bg-on-accent text-ink shadow-[5px_5px_0_0_var(--color-on-accent)] hover:shadow-[9px_9px_0_0_var(--color-on-accent)]"
            >
              Create account
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
