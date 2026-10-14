import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "./container";
import { PageHeader } from "./page-header";

type NotConnectedBodyProps = {
  /** Which implementation phase will connect this page. */
  phase: string;
  /** What the finished page will do, shown as a short list. */
  planned: ReactNode[];
};

/**
 * Honest placeholder for features whose backend isn't built yet.
 * Shows no sample data, so nothing on the page can be mistaken for a real feature.
 */
export function NotConnectedBody({ phase, planned }: NotConnectedBodyProps) {
  return (
    <Container className="flex flex-col gap-8 py-12">
      <Alert tone="warning" title={`Not connected yet — arrives in ${phase}`}>
        This feature is a layout placeholder. It doesn&apos;t read or save any data yet.
      </Alert>
      <div className="flex flex-col gap-3">
        <p className="font-bold uppercase tracking-wide">When connected, this page will:</p>
        <ul className="flex list-none flex-col gap-2">
          {planned.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 border-2 border-ink bg-mint" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </Container>
  );
}

type NotConnectedProps = NotConnectedBodyProps & { eyebrow: string; title: string; description: string };

export function NotConnected({ eyebrow, title, description, ...body }: NotConnectedProps) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <NotConnectedBody {...body} />
    </>
  );
}
