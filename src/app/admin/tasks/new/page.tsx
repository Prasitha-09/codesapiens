import type { Metadata } from "next";
import Link from "next/link";
import { TaskForm } from "@/components/admin/task-form";
import { Container } from "@/components/layout/container";
import { H1 } from "@/components/ui/typography";
import { createTask } from "@/lib/admin/actions";

export const metadata: Metadata = { title: "New task" };

export default function NewTaskPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-10">
      <Link href="/admin/tasks" className="font-mono text-sm font-bold underline-offset-4 hover:underline">
        ← All tasks
      </Link>
      <H1 className="text-3xl sm:text-4xl">New task</H1>
      <TaskForm
        action={createTask}
        submitLabel="Create task"
        initial={{
          title: "",
          description: "",
          requirements: "",
          reward_coins: "10",
          deadline: "",
          evidence_required: false,
          status: "draft",
        }}
      />
    </Container>
  );
}
