'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [projects] = useState([
    { id: '1', name: 'Q4 Planning', nodesCount: 12, updatedAt: '2024-01-15' },
    { id: '2', name: 'Product Launch', nodesCount: 8, updatedAt: '2024-01-14' },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <button className="rounded-lg bg-primary-600 px-4 py-2 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
              New Project
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Nodes</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">20</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Agents</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">3</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed Today</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">5</p>
          </div>
        </div>

        {/* Projects */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Projects
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {project.nodesCount} nodes
                    </p>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {project.updatedAt}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
