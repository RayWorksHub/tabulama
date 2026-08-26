'use client'

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">Az adminadatok nem tölthetők be</h1>
      <p className="mt-3 text-slate-600">Ellenőrizd az adatbázis-kapcsolatot és a migráció futtatását, majd próbáld újra.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-xl bg-[#1b2430] px-5 py-3 font-bold text-white">
        Újrapróbálás
      </button>
    </div>
  )
}
