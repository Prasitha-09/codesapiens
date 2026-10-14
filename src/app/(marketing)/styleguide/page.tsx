import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea, fieldDescribedBy } from "@/components/ui/form";
import { Display, Eyebrow, H1, H2, H3, Highlight, Lead, Text } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false, follow: false },
};

const swatches = [
  { name: "ink", className: "bg-ink" },
  { name: "paper", className: "bg-paper" },
  { name: "surface", className: "bg-surface" },
  { name: "muted", className: "bg-muted" },
  { name: "mint", className: "bg-mint" },
  { name: "sun", className: "bg-sun" },
  { name: "sky", className: "bg-sky" },
  { name: "pink", className: "bg-pink" },
  { name: "danger", className: "bg-danger" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-b-[3px] border-dashed border-ink/30 pb-12">
      <H2>{title}</H2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <>
      <PageHeader
        eyebrow="Design system"
        title="Code Sapiens style guide"
        description="The shared Neo-Brutalist building blocks of The Challenge Arena. Use these components instead of one-off styles."
      />
      <Container className="flex flex-col gap-12 py-12">
        <Section title="Colors">
          <ul className="grid list-none grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-9">
            {swatches.map((s) => (
              <li key={s.name} className="flex flex-col gap-2">
                <span className={`block h-16 rounded-brutal border-[3px] border-ink shadow-brutal-sm ${s.className}`} />
                <span className="font-mono text-xs font-bold">{s.name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Typography">
          <div className="flex flex-col gap-4">
            <Eyebrow>Eyebrow label</Eyebrow>
            <Display>
              Display <Highlight>heading</Highlight>
            </Display>
            <H1>Heading one</H1>
            <H2>Heading two</H2>
            <H3>Heading three</H3>
            <Lead>Lead paragraph for introductions and page summaries.</Lead>
            <Text>
              Body text is set in Space Grotesk. <code className="font-mono">Monospace</code> is used for numbers, codes
              and labels.
            </Text>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <ButtonLink href="/" variant="secondary">
              Link button
            </ButtonLink>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-3">
            <Badge>Neutral</Badge>
            <Badge tone="sun">Pending</Badge>
            <Badge tone="mint">Approved</Badge>
            <Badge tone="danger">Rejected</Badge>
            <Badge tone="sky">Info</Badge>
            <Badge tone="pink">New</Badge>
            <Badge tone="ink">Admin</Badge>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Card title</CardTitle>
                <CardDescription>Supporting description text.</CardDescription>
              </CardHeader>
              <CardBody>
                <Text>Cards group related content with a thick border and hard shadow.</Text>
              </CardBody>
              <CardFooter>
                <Button size="sm">Action</Button>
                <Button size="sm" variant="ghost">
                  Cancel
                </Button>
              </CardFooter>
            </Card>
            <Card tone="sun">
              <CardBody className="flex flex-col gap-2">
                <CardTitle>Toned card</CardTitle>
                <Text>Use tones sparingly to highlight one thing.</Text>
              </CardBody>
            </Card>
            <Card tone="mint" interactive>
              <CardBody className="flex flex-col gap-2">
                <CardTitle>Interactive card</CardTitle>
                <Text>Lifts on hover — only for fully clickable cards.</Text>
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section title="Alerts">
          <div className="grid gap-4 md:grid-cols-2">
            <Alert tone="info" title="Info">
              Neutral information for the user.
            </Alert>
            <Alert tone="success" title="Success">
              Something worked as expected.
            </Alert>
            <Alert tone="warning" title="Warning">
              Something needs attention.
            </Alert>
            <Alert tone="danger" title="Error">
              Something went wrong.
            </Alert>
          </div>
        </Section>

        <Section title="Form controls">
          <Alert tone="info">Visual preview only. These controls are not wired to any action.</Alert>
          <div className="grid max-w-2xl gap-5">
            <Field htmlFor="sg-name" label="Display name" hint="Shown on your public profile." required>
              <Input
                id="sg-name"
                placeholder="Ada Lovelace"
                aria-describedby={fieldDescribedBy("sg-name", { hint: "Shown on your public profile." })}
              />
            </Field>
            <Field htmlFor="sg-email" label="Email" error="Enter a valid email address.">
              <Input
                id="sg-email"
                type="email"
                defaultValue="not-an-email"
                aria-invalid
                aria-describedby={fieldDescribedBy("sg-email", { error: "Enter a valid email address." })}
              />
            </Field>
            <Field htmlFor="sg-status" label="Status">
              <Select id="sg-status" defaultValue="active">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field htmlFor="sg-proof" label="Proof">
              <Textarea id="sg-proof" placeholder="Describe what you did…" />
            </Field>
            <Field htmlFor="sg-disabled" label="Disabled">
              <Input id="sg-disabled" disabled value="Read only" readOnly />
            </Field>
          </div>
        </Section>
      </Container>
    </>
  );
}
