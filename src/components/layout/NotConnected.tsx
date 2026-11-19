/** Shown when the site was built without the server address, so nothing can be saved. */
export default function NotConnected() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-xl border border-amber-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-800">Not connected to the hospital server</h1>
        <p className="mt-2 text-sm text-slate-500">
          This copy of the app was built without the server's address, so it can't sign anyone in or save anything. The person who looks after the site needs to set <code className="rounded bg-slate-100 px-1">VITE_API_URL</code> and publish again.
        </p>
      </div>
    </div>
  );
}
