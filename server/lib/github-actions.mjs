/**
 * Trigger GitHub Actions workflow_dispatch untuk publish visual website.
 * Env: GITHUB_PUBLISH_TOKEN, GITHUB_REPO (owner/name), optional GITHUB_PUBLISH_WORKFLOW
 */

const API = 'https://api.github.com';
const DEFAULT_WORKFLOW = 'publish-visuals.yml';
const DEFAULT_REPO = 'gehcofficial/gehc.page';

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export function publishVisualsConfigured() {
  return Boolean(process.env.GITHUB_PUBLISH_TOKEN?.trim() && parseRepo().owner && parseRepo().repo);
}

export function parseRepo() {
  const raw = (process.env.GITHUB_REPO || DEFAULT_REPO).trim();
  const [owner, repoRaw] = raw.split('/');
  const repo = (repoRaw || '').replace(/\.git$/i, '');
  return { owner, repo };
}

function workflowFile() {
  return (process.env.GITHUB_PUBLISH_WORKFLOW || DEFAULT_WORKFLOW).trim();
}

async function ghFetch(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: ghHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody.message || res.statusText || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function triggerPublishVisualsWorkflow({ folder = '', branch = 'staging' } = {}) {
  const token = process.env.GITHUB_PUBLISH_TOKEN?.trim();
  if (!token) throw new Error('GITHUB_PUBLISH_TOKEN belum dikonfigurasi.');
  const { owner, repo } = parseRepo();
  if (!owner || !repo) throw new Error('GITHUB_REPO tidak valid (format: owner/repo).');

  const ref = branch === 'main' ? 'main' : 'staging';
  const folderInput = folder ? String(folder).toLowerCase().trim() : '';

  await ghFetch(`/repos/${owner}/${repo}/actions/workflows/${workflowFile()}/dispatches`, {
    token,
    method: 'POST',
    body: {
      ref,
      inputs: {
        folder: folderInput,
        target_branch: ref,
      },
    },
  });

  await new Promise((r) => setTimeout(r, 2500));

  const runs = await ghFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowFile()}/runs?event=workflow_dispatch&branch=${encodeURIComponent(ref)}&per_page=5`,
    { token }
  );
  const run = (runs?.workflow_runs || [])[0] || null;

  return {
    runId: run?.id ?? null,
    status: run?.status ?? 'queued',
    conclusion: run?.conclusion ?? null,
    htmlUrl: run?.html_url ?? null,
    branch: ref,
    folder: folderInput || null,
  };
}

export async function getPublishVisualsRun(runId) {
  const token = process.env.GITHUB_PUBLISH_TOKEN?.trim();
  if (!token) throw new Error('GITHUB_PUBLISH_TOKEN belum dikonfigurasi.');
  const { owner, repo } = parseRepo();
  const id = Number(runId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('runId tidak valid.');

  const run = await ghFetch(`/repos/${owner}/${repo}/actions/runs/${id}`, { token });
  return {
    runId: run.id,
    status: run.status,
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  };
}
