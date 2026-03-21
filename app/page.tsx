import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">C|CT Practice App</h1>
      <p>這是可直接部署到 GitHub Pages 的靜態版本。</p>
      <div className="flex gap-2">
        <Link className="rounded bg-blue-600 px-4 py-2 text-white" href="/dashboard">
          前往 Dashboard
        </Link>
        <Link className="rounded border px-4 py-2" href="/exam">
          開始正式模擬考
        </Link>
      </div>
    </div>
  );
}
