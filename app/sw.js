// Made by scripts/make-sw.mjs — do not edit. Version 5b5b8b359d49.
const SHELL = 'oral-shell-5b5b8b359d49';
const IMAGES = 'oral-images';
const FILES = ["/app/","/app/_expo/static/js/web/entry-9cdefa8ad80c06d82038acd7a200b6ab.js","/app/apple-touch-icon.png","/app/assets/node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.51b6ad87261f18b6433ec52871ddfabc.ttf","/app/assets/node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.137ab18bace28dd0bd83eb3b8ed2bc54.ttf","/app/assets/node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.a5f35888d2da465de352e0dcfaf33324.ttf","/app/assets/node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.6e237de4f1f413afa2fcc45c77ac343a.ttf","/app/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf","/app/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf","/app/favicon.ico","/app/icons/icon-192.png","/app/icons/icon-512.png","/app/icons/icon-maskable-192.png","/app/icons/icon-maskable-512.png","/app/manifest.json","/app/metadata.json"];
const LEAVE = [];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('oral-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Keeps at most this many images; the oldest go first.
async function trim(cache, max) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // Video and audio are read in pieces (range requests): the browser handles them itself.
  if (request.headers.has('range') || request.destination === 'video' || request.destination === 'audio') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && LEAVE.some((path) => url.pathname.startsWith(path))) return;

  // Pages: the network first (latest version), the kept app without network. One page app: every
  // address opens the app, which shows the right screen.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/app/', { cacheName: SHELL })));
    return;
  }

  if (url.origin === self.location.origin) {
    // The app's own files: kept ones at once, others from the network.
    if (request.destination === 'image') {
      event.respondWith(
        caches.open(IMAGES).then(async (cache) => {
          const hit = (await caches.match(request, { cacheName: SHELL })) || (await cache.match(request));
          if (hit) return hit;
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone()).then(() => trim(cache, 300));
          return response;
        }),
      );
      return;
    }
    event.respondWith(caches.match(request, { cacheName: SHELL }).then((hit) => hit || fetch(request)));
    return;
  }

  // Public images of the server (covers, thumbnails): each file has its own name, never rewritten.
  // Everything else from the server (member data, signed video addresses, payments) is never kept.
  if (request.destination === 'image' && url.pathname.includes('/storage/v1/object/public/')) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone()).then(() => trim(cache, 300));
        return response;
      }),
    );
  }
});
