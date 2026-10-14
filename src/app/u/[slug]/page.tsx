import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { InitialsAvatar } from "@/components/profile/initials-avatar";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/typography";
import { getPublicProfile } from "@/lib/profile/data";
import { readSocialLinks } from "@/lib/profile/social-links";

// Public profiles are shared by link/QR; keep them out of search engines.
const robots = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<"/u/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug).catch(() => null);
  if (!profile) return { title: "Profile not found", robots };
  const name = profile.display_name ?? profile.username;
  return { title: `${name} (@${profile.username})`, description: `${name}'s Code Sapiens profile.`, robots };
}

export default function PublicProfilePage({ params }: PageProps<"/u/[slug]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <PublicProfileContent params={params} />
    </Suspense>
  );
}

const dateFormat = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" });

async function PublicProfileContent({ params }: { params: PageProps<"/u/[slug]">["params"] }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  // Unknown, malformed and private profiles all look identical.
  if (!profile) notFound();

  const name = profile.display_name ?? profile.username;
  const links = readSocialLinks(profile.social_links);

  const stats = [
    { label: "Coins earned", value: Number(profile.lifetime_coins).toLocaleString("en"), tone: "bg-mint text-on-accent" },
    { label: "Rank", value: profile.leaderboard_rank ? `#${profile.leaderboard_rank}` : "—", tone: "bg-surface" },
    { label: "Challenges", value: profile.approved_tasks.toLocaleString("en"), tone: "bg-surface" },
  ];

  return (
    <>
      <header className="relative overflow-hidden border-b-[3px] border-ink">
        <div aria-hidden="true" className="bg-lines absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-mint" />
        <Container className="relative flex flex-col items-start gap-8 py-12 sm:flex-row sm:items-center sm:py-16">
          <InitialsAvatar name={name} className="size-28 text-5xl sm:size-36 sm:text-6xl" />
          <div className="flex min-w-0 flex-col gap-3">
            <p className="w-fit -rotate-1 border-[3px] border-ink bg-surface px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.25em] text-mint">
              Code Sapiens participant
            </p>
            <h1 className="break-words font-display text-5xl uppercase leading-[0.92] sm:text-7xl">{name}</h1>
            <p className="font-mono text-lg text-subtle">
              @{profile.username} · since {dateFormat.format(new Date(profile.member_since))}
            </p>
          </div>
        </Container>
      </header>

      <Container className="grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-10">
          <dl className="grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label} className={`flex flex-col gap-1 border-[3px] border-ink p-4 shadow-brutal ${s.tone}`}>
                <dt className="font-mono text-xs font-bold uppercase tracking-wider">{s.label}</dt>
                <dd className="font-display text-4xl leading-none sm:text-5xl">{s.value}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="about" className="flex flex-col gap-3">
            <h2 id="about" className="font-display text-3xl uppercase">
              About
            </h2>
            {profile.bio ? (
              <Text className="whitespace-pre-line break-words text-lg">{profile.bio}</Text>
            ) : (
              <Text className="text-subtle">No bio yet.</Text>
            )}
          </section>
        </div>

        {links.length > 0 && (
          <section aria-labelledby="links" className="flex flex-col gap-3">
            <h2 id="links" className="font-display text-3xl uppercase">
              Links
            </h2>
            <ul className="flex list-none flex-col gap-3">
              {links.map((link) => (
                <li key={link.platform}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="flex items-center justify-between gap-3 border-[3px] border-ink bg-surface px-4 py-3 font-bold shadow-brutal-sm transition-transform hover:-translate-y-0.5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Badge tone="sky">{link.label}</Badge>
                      <span className="truncate font-mono text-sm font-normal">{link.url.replace(/^https:\/\//, "")}</span>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>
    </>
  );
}
