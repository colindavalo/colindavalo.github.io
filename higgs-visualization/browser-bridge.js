'use strict';
/* Compatibility layer for the existing UI's /api/jobs protocol. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const worker = new Worker('pyodide-worker.js');
  const jobs = new Map();
  let sequence = 0;

  const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: {'Content-Type': 'application/json'}
  });
  const errorResponse = error => jsonResponse({error: String(error.message || error)}, 400);
  const post = message => worker.postMessage(message);

  worker.onmessage = ({data}) => {
    const job = jobs.get(data.id);
    if (!job) return;
    if (data.type === 'progress') { job.status = 'running'; job.message = data.message; }
    if (data.type === 'ready') { job.status = 'running'; job.message = 'Python and scientific packages loaded.'; }
    if (data.type === 'complete') { job.status = 'complete'; job.message = 'Complete'; job.result = data.result; }
    if (data.type === 'error') { job.status = 'failed'; job.message = data.message; }
  };
  worker.onerror = event => {
    for (const job of jobs.values()) if (job.status === 'queued' || job.status === 'running') {
      job.status = 'failed'; job.message = `Browser solver failed: ${event.message}`;
    }
  };

  window.fetch = async (input, init = {}) => {
    const originalUrl = typeof input === 'string' ? input : input.url;
    const url = originalUrl.startsWith('api/') ? `/${originalUrl}` : originalUrl;
    const method = (init.method || 'GET').toUpperCase();
    if (!url.startsWith('/api/')) return nativeFetch(input, init);
    try {
      if (url === '/api/jobs' && method === 'POST') {
        const id = `browser-${++sequence}`;
        const job = {id, status: 'queued', message: 'Starting Python in this browser…'};
        jobs.set(id, job);
        post({type: 'solve', id, payload: JSON.parse(init.body)});
        return jsonResponse({id}, 202);
      }
      const match = url.match(/^\/api\/jobs\/([^/]+)(\/result)?$/);
      if (match) {
        const job = jobs.get(match[1]);
        if (!job) return jsonResponse({error: 'Job expired or not found'}, 404);
        if (method === 'DELETE') {
          /* A Worker can be interrupted only by replacing it.  The UI also
             ignores stale generations, so this safely implements cancellation. */
          job.status = 'cancelled'; job.message = 'Cancelled';
          return jsonResponse({cancelled: true});
        }
        if (match[2]) return job.status === 'complete'
          ? jsonResponse({id: job.id, status: job.status, message: job.message, result: job.result})
          : jsonResponse({error: job.message}, 409);
        return jsonResponse({id: job.id, status: job.status, message: job.message});
      }
      return jsonResponse({error: 'Not found'}, 404);
    } catch (error) { return errorResponse(error); }
  };
})();
