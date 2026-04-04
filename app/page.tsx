import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold sm:text-3xl">C|CT Practice App</h1>
      <p className="text-sm text-slate-600 sm:text-base">這是可直接部署到 GitHub Pages 的靜態版本。</p>
      <div className="grid gap-2 sm:flex">
        <Link className="rounded bg-blue-600 px-4 py-3 text-center text-white" href="/dashboard">
          前往 Dashboard
        </Link>
        <Link className="rounded border px-4 py-3 text-center" href="/exam">
          開始正式模擬考
        </Link>
      </div>
    </div>
  );
}
