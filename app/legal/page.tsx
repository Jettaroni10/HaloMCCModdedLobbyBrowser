export default function LegalPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Legal &amp; rules</h1>
      <p className="mt-2 text-sm text-ink/70">
        Please read before hosting or requesting invites.
      </p>

      <div className="mt-6 space-y-6 rounded-3xl border border-ink/10 bg-sand p-6 text-sm text-ink/70">
        <section>
          <h2 className="text-lg font-semibold text-ink">Non-affiliation</h2>
          <p className="mt-2">
            Not affiliated with Microsoft, Xbox, 343 Industries, or Halo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Safety &amp; scope</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>This app does not interact with MCC networking or game state.</li>
            <li>No Halo assets or official branding are used.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">What this app is</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Opt-in lobby listings published by hosts.</li>
            <li>Invite request tracking and coordination.</li>
            <li>Metadata for modded lobbies, including Steam Workshop links.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">
            What this app is not
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>It does not read MCC state or scan sessions.</li>
            <li>It does not hook/inject, inspect packets, or auto-join.</li>
            <li>It does not send invites via Steam or Xbox APIs.</li>
            <li>It does not download or install mods.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Modded lobbies</h2>
          <p className="mt-2">
            We do not distribute mods; we only link to Steam Workshop.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Host rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Only publish lobbies you control.</li>
            <li>Be explicit about mod requirements and invite flow.</li>
            <li>Remove or close stale lobbies promptly.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Player rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Respect host instructions and availability.</li>
            <li>Share only the details hosts request.</li>
            <li>Keep requests relevant and concise.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
