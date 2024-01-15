console.log('serviceworked!');

this.addEventListener('fetch', (event) => {
  event.respondWith(
    (async function () {
      try {
        const res = await fetch(event.request);
        console.log('Will cache', event.request, res);
        const cache = await caches.open('cache');
        cache.put(event.request.url, res.clone());
        return res;
      } catch (error) {
        console.log('CACHED', event.request);
        return caches.match(event.request);
      }
    })(),
  );
});