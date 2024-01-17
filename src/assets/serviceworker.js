

async function saveTx(req, res) {
  console.log('Caching', new URL(req.url).pathname, res.status);
  const cache = await caches.open('cache');
  cache.put(req.url, res.clone());
};

function mergeStates(current, update) {
  let nextProjects = [...current.projects]
  update.projects.forEach(project => {
    nextProjects = current.projects.filter(p => p.id !== project.id).concat(project)
  })

  let nextLines = [...current.lines]
  update.lines.forEach(line => {
    nextLines = current.lines.filter(l => l.id !== line.id).concat(line)
  })

  const nextState = { projects: nextProjects, lines: nextLines }
  console.log({ current, nextState })
  return nextState
}

const getPendingState = () => {
  let state = localStorage.getItem(PENDING);
  if (state == null) return { projects: [], lines: [] };
  return JSON.parse(state)
}
const setPendingState = (nextState)=>localStorage.setItem(PENDING, JSON.stringify(nextState));

const PENDING = 'pending-state'
this.addEventListener('fetch', (event) => {
  console.log('--v22 ');

  event.respondWith(
    (async function () {
      const method = event.request.method
      const reqBody = method === 'POST' ? event.request.clone().json() : undefined
      const url = new URL(event.request.url)
      try {
        const res = await fetch(event.request);
        if (url.protocol.startsWith('http')) // Skip Chrome extensions requests
          await saveTx(event.request, res);
        return res;
      } catch (error) {
        console.log('CACHED', event.request.url);
        if (url.pathname === '/data.json' && method === 'POST') {

          const state = getPendingState()
          const updateState = await reqBody;
          const nextState = mergeStates(state, updateState);
          console.log({state, updateState, nextState})
          setPendingState(nextState)

          // const res = await caches.match(event.request.url)

          // // Craft the next response from the cache
          // const nextState = saveUpdate(await res.json(), await reqBody)
          // const nextRes = new Response(
          //   JSON.stringify(nextState),
          //   { headers: res.headers, url: res.url }
          // )
          // console.log('Crafted', nextState, res)
          // await saveTx(event.request, nextRes);
        }
        return caches.match(event.request.url);
      }
    })(),
  );
});