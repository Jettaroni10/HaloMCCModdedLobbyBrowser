import { notFound } from "next/navigation";
import DevChecklist from "@/components/DevChecklist";

export default function DevChecklistPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">MVP test checklist</h1>
      <p className="mt-2 text-sm text-ink/70">
        Walk through each step before calling the MVP done.
      </p>
      <div className="mt-6">
        <DevChecklist />
      </div>
    </div>
  );
}

