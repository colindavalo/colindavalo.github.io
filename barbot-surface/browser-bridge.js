/* Provide the explorer's local API using a Web Worker instead of a server. */
'use strict';
(() => {
  const originalFetch = window.fetch.bind(window);
  if (location.protocol === 'file:') {
    const message = 'Open this visualization over HTTP. Double-click Preview-site.cmd in the site folder to start the local preview, and keep its window open.';
    const notice = document.createElement('p');
    notice.className = 'local-preview-notice';
    notice.textContent = message;
    document.body.prepend(notice);
    window.fetch = async (input, init) => {
      const raw = typeof input === 'string' ? input : input.url;
      if (raw.startsWith('api/')) return new Response(JSON.stringify({error: message}), {
        status: 400, headers: {'Content-Type': 'application/json'}
      });
      return originalFetch(input, init);
    };
    return;
  }
  const scriptUrl = document.currentScript.src;
  const apiPrefix = new URL('api/', scriptUrl).pathname;
  const worker = new Worker(new URL('barbot-worker.js', scriptUrl));
  const pending = new Map();
  const jobs = new Map();
  let sequence = 0;

  const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: {'Content-Type': 'application/json'}
  });
  const request = (type, payload) => new Promise((resolve, reject) => {
    const id = `request-${++sequence}`;
    pending.set(id, {resolve, reject});
    worker.postMessage({type, id, payload});
  });

  worker.onmessage = ({data}) => {
    const job = jobs.get(data.id);
    if (data.type === 'progress' && job && job.status !== 'cancelled') {
      job.status = 'running';
      job.message = data.message;
    }
    if (data.type === 'ready' && job && job.status === 'queued') {
      job.status = 'running';
    }
    if (data.type === 'result' && job) {
      if (job.status !== 'cancelled') {
        // The worker applies a completed representation only after this job
        // is accepted. A cancelled calculation cannot replace the active one.
        worker.postMessage({type: 'activate', id: job.id, payload: data.result});
        job.status = 'complete';
        job.message = 'Representation ready';
      }
    }
    if (data.type === 'error' && job && job.status !== 'cancelled') {
      job.status = 'failed';
      job.message = data.message;
    }
    const call = pending.get(data.id);
    if (!call || !['result', 'error'].includes(data.type)) return;
    pending.delete(data.id);
    if (data.type === 'result') call.resolve(data.result);
    else call.reject(Error(data.message));
  };
  worker.onerror = event => {
    const message = `Browser solver failed: ${event.message}`;
    for (const call of pending.values()) call.reject(Error(message));
    pending.clear();
    for (const job of jobs.values()) if (['queued', 'running'].includes(job.status)) {
      job.status = 'failed'; job.message = message;
    }
  };

  window.fetch = async (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, document.baseURI);
    if (url.origin !== location.origin || !url.pathname.startsWith(apiPrefix)) {
      return originalFetch(input, init);
    }
    const path = url.pathname.slice(apiPrefix.length);
    const method = (init.method || 'GET').toUpperCase();
    try {
      if (path === 'info' && method === 'GET') return jsonResponse(await request('info'));
      if (path === 'holonomy' && method === 'GET') return jsonResponse(await request('holonomy'));
      if (path === 'sample' && method === 'POST') {
        return jsonResponse(await request('sample', JSON.parse(init.body)));
      }
      if (path === 'recompute' && method === 'POST') {
        const id = `browser-${++sequence}`;
        jobs.set(id, {id, status: 'queued', message: 'Starting Python in this browser…'});
        worker.postMessage({type: 'recompute', id, payload: JSON.parse(init.body)});
        return jsonResponse({id}, 202);
      }
      if (path.startsWith('jobs/') && method === 'GET') {
        const job = jobs.get(path.slice(5));
        return job ? jsonResponse(job) : jsonResponse({error: 'Unknown computation'}, 404);
      }
      if (path.startsWith('cancel/') && method === 'POST') {
        const job = jobs.get(path.slice(7));
        if (!job) return jsonResponse({error: 'Unknown computation'}, 404);
        job.status = 'cancelled';
        job.message = 'Cancelled; previous representation retained';
        return jsonResponse({cancelled: true});
      }
      return jsonResponse({error: 'Not found'}, 404);
    } catch (error) {
      return jsonResponse({error: String(error.message || error)}, 400);
    }
  };
})();
