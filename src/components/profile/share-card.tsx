"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { regeneratePublicLink, type RegenerateLinkState } from "@/lib/profile/actions";

type ShareCardProps = {
  publicUrl: string;
  /** SVG data: URI rendered on the server. */
  qrDataUri: string;
  isPublic: boolean;
};

const initialRegenerate: RegenerateLinkState = { status: "idle" };

export function ShareCard({ publicUrl, qrDataUri, isPublic }: ShareCardProps) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [regen, regenAction, regenPending] = useActionState(regeneratePublicLink, initialRegenerate);

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Share your profile</CardTitle>
        <Badge tone={isPublic ? "mint" : "sun"}>{isPublic ? "Public" : "Private"}</Badge>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        {!isPublic && (
          <Alert tone="warning">
            Your profile is private, so this link and QR code currently show &ldquo;not found&rdquo; to others.
          </Alert>
        )}

        <div className="mx-auto w-full max-w-64 border-[3px] border-ink bg-surface p-2 shadow-brutal">
          {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data: URI */}
          <img src={qrDataUri} alt={`QR code linking to ${publicUrl}`} className="block aspect-square w-full" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold uppercase tracking-wide">Public link</p>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate border-[3px] border-ink bg-muted px-3 py-2 font-mono text-sm">
              {publicUrl}
            </code>
            <Button variant="secondary" onClick={copy} aria-label="Copy public link">
              Copy
            </Button>
          </div>
          <p role="status" className="min-h-5 text-sm">
            {copied === "copied" && "Link copied."}
            {copied === "failed" && "Couldn't copy automatically — select the link and copy it."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href="/profile/qr?format=png" download className={buttonStyles({ size: "sm" })}>
            Download PNG
          </a>
          <a href="/profile/qr?format=svg" download className={buttonStyles({ size: "sm", variant: "secondary" })}>
            Download SVG
          </a>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles({ size: "sm", variant: "ghost" })}
          >
            View public page ↗
          </a>
        </div>
      </CardBody>
      <CardFooter className="flex-col items-start gap-3">
        <form
          action={regenAction}
          onSubmit={(e) => {
            if (!window.confirm("Create a new link? Your current link and any printed QR codes will stop working.")) {
              e.preventDefault();
            }
          }}
        >
          <Button type="submit" variant="danger" size="sm" disabled={regenPending}>
            {regenPending ? "Creating new link…" : "Reset link & QR code"}
          </Button>
        </form>
        {regen.status === "done" && <p role="status" className="text-sm">New link created. Old links no longer work.</p>}
        {regen.status === "error" && (
          <p role="alert" className="text-sm font-bold">
            {regen.message}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
