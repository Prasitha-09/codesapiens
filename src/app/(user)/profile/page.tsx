import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { ShareCard } from "@/components/profile/share-card";
import { InitialsAvatar } from "@/components/profile/initials-avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getOwnProfile } from "@/lib/profile/data";
import { publicProfileUrl } from "@/lib/profile/public-url";
import { qrSvgDataUri } from "@/lib/profile/qr";
import { type SocialLinks, readSocialLinks } from "@/lib/profile/social-links";

export const metadata: Metadata = { title: "My Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="My Profile"
        description="Edit what others see, then share your public page with its QR code."
      />
      <Suspense fallback={<PageLoading />}>
        <ProfileContent />
      </Suspense>
    </>
  );
}

async function ProfileContent() {
  const result = await getOwnProfile();

  if (result.status !== "ok") {
    const message = {
      "schema-missing": "Your database is missing the latest profile changes. Apply migration 3 (see the README).",
      missing: "Your account has no profile row yet. See the README for the one-line backfill.",
      error: "We couldn't load your profile. Please refresh the page.",
    }[result.status];
    return (
      <Container className="py-12">
        <Alert tone={result.status === "error" ? "danger" : "warning"} title="Profile unavailable">
          {message}
        </Alert>
      </Container>
    );
  }

  const { profile } = result;
  const publicUrl = publicProfileUrl(profile.public_slug);
  const qrDataUri = await qrSvgDataUri(publicUrl);

  const links = readSocialLinks(profile.social_links);
  const socialLinks: SocialLinks = Object.fromEntries(links.map((l) => [l.platform, l.url]));

  return (
    <Container className="grid gap-8 py-12 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <ProfileForm
        initial={{
          username: profile.username,
          displayName: profile.display_name ?? "",
          bio: profile.bio ?? "",
          isPublic: profile.is_public,
          socialLinks,
        }}
      />
      <div className="flex flex-col gap-8 lg:sticky lg:top-24">
        <section aria-label="How others see you" className="flex flex-col gap-4 border-[3px] border-ink bg-surface p-6 shadow-brutal">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-mint">Preview</p>
          <div className="flex items-center gap-4">
            <InitialsAvatar name={profile.display_name ?? profile.username} className="size-16 text-2xl" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="truncate font-display text-3xl uppercase leading-none">{profile.display_name ?? profile.username}</p>
              <p className="truncate font-mono text-sm text-subtle">@{profile.username}</p>
            </div>
          </div>
          {profile.bio && <p className="whitespace-pre-line break-words text-sm">{profile.bio}</p>}
          <div className="flex flex-wrap gap-2">
            <Badge tone={profile.is_public ? "mint" : "sun"}>{profile.is_public ? "Public" : "Private"}</Badge>
            {links.map((l) => (
              <Badge key={l.platform} tone="sky">
                {l.label}
              </Badge>
            ))}
          </div>
        </section>
        <ShareCard publicUrl={publicUrl} qrDataUri={qrDataUri} isPublic={profile.is_public} />
      </div>
    </Container>
  );
}
