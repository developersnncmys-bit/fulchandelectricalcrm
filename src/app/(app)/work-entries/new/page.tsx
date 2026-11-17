"use client";
import { PageHeader } from "@/components/ui";
import { WorkEntryForm } from "@/components/work-entry-form";

export default function NewWorkEntry() {
  return (
    <>
      <PageHeader title="New Work / Material Entry" back="/work-entries" subtitle="Record validated site work and material details" />
      <WorkEntryForm />
    </>
  );
}
