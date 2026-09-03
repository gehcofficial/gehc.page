export interface VisualsPublishConfig {
  configured: boolean;
  folders: { id: string; label: string }[];
  defaultFolder: string;
  defaultBranch: string;
  branches: string[];
}

export interface VisualsPublishRun {
  runId: number | null;
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
  branch?: string;
  folder?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchVisualsPublishConfig(): Promise<VisualsPublishConfig> {
  const res = await fetch('/api/admin/visuals/publish/config', { credentials: 'include' });
  return handle(res);
}

export async function triggerVisualsPublish(body: {
  folder?: string;
  branch?: string;
}): Promise<{ ok: boolean } & VisualsPublishRun> {
  const res = await fetch('/api/admin/visuals/publish', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function fetchVisualsPublishStatus(runId: number): Promise<VisualsPublishRun> {
  const res = await fetch(`/api/admin/visuals/publish/status/${runId}`, { credentials: 'include' });
  return handle(res);
}
