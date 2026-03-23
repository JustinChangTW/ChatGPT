const PROGRESS_KEYS = [
  'cct_practice_history_v1',
  'cct_exam_history_v1',
  'cct_wrong_notebook_v1',
  'cct_learning_progress_v1',
  'cct_dashboard_stats_v1'
] as const;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function resetLearningProgress(): { removed: string[] } {
  if (!isBrowser()) return { removed: [] };

  const removed: string[] = [];
  PROGRESS_KEYS.forEach((key) => {
    if (window.localStorage.getItem(key) !== null) {
      window.localStorage.removeItem(key);
      removed.push(key);
    }
  });

  return { removed };
}

