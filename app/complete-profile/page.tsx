import { requireAuth } from "@/lib/auth";
import CompleteProfileForm from "@/components/auth/CompleteProfileForm";

export default async function CompleteProfilePage() {
  const user = await requireAuth({ requireGamertag: false });

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">
        Complete your profile
      </h1>
      <p className="mt-2 text-sm text-ink/70">
        Choose a gamertag to continue. This is what players will see.
      </p>
      <CompleteProfileForm initialGamertag={user.gamertag ?? ""} />
    </div>
  );
}
