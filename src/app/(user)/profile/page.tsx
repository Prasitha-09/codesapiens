import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { ShareCard } from "@/components/profile/share-card";
import { Alert } from "@/components/ui/alert";
import { getOwnProfile } from "@/lib/profile/data";
import { publicProfileUrl } from "@/lib/profile/public-url";
import { qrSvgDataUri } from "@/lib/profile/qr";
import { type SocialLinks, readSocialLinks } from "@/lib/profile/social-links";

export const metadata: Metadata = { title: "Your profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="Your profile"
        description="Edit what others see, and share your public page with a QR code."
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
      <div className="lg:sticky lg:top-24">
        <ShareCard publicUrl={publicUrl} qrDataUri={qrDataUri} isPublic={profile.is_public} />
      </div>
    </Container>
  );
}
