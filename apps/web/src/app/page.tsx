import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          GlassBox
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Transparent collaborative workspace for human-agent workflows.
          Structure your work into composable, auditable nodes.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            className="rounded-lg bg-primary-600 px-6 py-3 text-white font-medium hover:bg-primary-700 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-3 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
