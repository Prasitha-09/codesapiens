import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
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
  const initials = name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";

  const stats = [
    { label: "Coins earned", value: Number(profile.lifetime_coins).toLocaleString("en") },
    { label: "Rank", value: profile.leaderboard_rank ? `#${profile.leaderboard_rank}` : "—" },
    { label: "Tasks done", value: profile.approved_tasks.toLocaleString("en") },
  ];

  return (
    <>
      <header className="border-b-[3px] border-ink bg-mint text-on-accent">
        <Container className="flex flex-col items-start gap-6 py-12 sm:flex-row sm:items-center">
          <div
            aria-hidden="true"
            className="flex size-24 shrink-0 items-center justify-center rounded-full border-[3px] border-on-accent bg-sun font-mono text-on-accent text-3xl font-bold shadow-brutal"
          >
            {initials}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="break-words text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{name}</h1>
            <p className="font-mono text-lg">@{profile.username}</p>
            <p className="text-sm">Member since {dateFormat.format(new Date(profile.member_since))}</p>
          </div>
        </Container>
      </header>

      <Container className="grid gap-8 py-12 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-8">
          <dl className="grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardBody className="flex flex-col gap-1 p-4">
                  <dt className="font-mono text-xs font-bold uppercase tracking-wider text-subtle">{s.label}</dt>
                  <dd className="text-2xl font-bold sm:text-3xl">{s.value}</dd>
                </CardBody>
              </Card>
            ))}
          </dl>

          <section aria-labelledby="about" className="flex flex-col gap-3">
            <h2 id="about" className="text-xl font-bold uppercase tracking-wide">
              About
            </h2>
            {profile.bio ? (
              <Text className="whitespace-pre-line break-words">{profile.bio}</Text>
            ) : (
              <Text className="text-subtle">No bio yet.</Text>
            )}
          </section>
        </div>

        {links.length > 0 && (
          <section aria-labelledby="links" className="flex flex-col gap-3">
            <h2 id="links" className="text-xl font-bold uppercase tracking-wide">
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
                      <span className="truncate font-mono text-sm font-normal">
                        {link.url.replace(/^https:\/\//, "")}
                      </span>
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
