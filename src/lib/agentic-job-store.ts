/**
 * In-memory job store per browser agentico (Playwright + Gemini).
 * Supporta risultati parziali per streaming real-time al frontend.
 */
import type { AgenticCrawlResult } from '@/types';

export type AgenticJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgenticJob {
  id: string;
  status: AgenticJobStatus;
  entryUrl: string;
  params: Record<string, unknown>;
  result?: AgenticCrawlResult;
  error?: string;
  currentStep?: number;
  totalSteps?: number;
  createdAt: Date;
  updatedAt: Date;
}

const jobs = new Map<string, AgenticJob>();

export function createAgenticJob(entryUrl: string, params: Record<string, unknown>): string {
  const id = crypto.randomUUID();
  const now = new Date();
  jobs.set(id, {
    id,
    status: 'pending',
    entryUrl,
    params,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export function getAgenticJob(id: string): AgenticJob | undefined {
  return jobs.get(id);
}

export function updateAgenticJob(
  id: string,
  update: Partial<Pick<AgenticJob, 'status' | 'result' | 'error' | 'currentStep' | 'totalSteps'>>
): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, update, { updatedAt: new Date() });
}
