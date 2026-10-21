// Made by scripts/make-sw.mjs — do not edit. Version 1454cc540ff8.
const SHELL = 'oral-shell-1454cc540ff8';
const IMAGES = 'oral-images';
const READER = 'oral-reader';
const FILES = ["/","/_expo/static/js/web/__common-634ce00fc04a34161a22e3268e45845d.js","/_expo/static/js/web/__expo-metro-runtime-e61693ae33497368646febbbae1b21fe.js","/_expo/static/js/web/entry-0e92228af3c85a3f989e963fdc3a762e.js","/apple-touch-icon.png","/assets/node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.51b6ad87261f18b6433ec52871ddfabc.ttf","/assets/node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.137ab18bace28dd0bd83eb3b8ed2bc54.ttf","/assets/node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.a5f35888d2da465de352e0dcfaf33324.ttf","/assets/node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.6e237de4f1f413afa2fcc45c77ac343a.ttf","/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf","/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf","/favicon.ico","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable-192.png","/icons/icon-maskable-512.png","/manifest.json","/metadata.json"];
const LEAVE = ["/app/"];

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
    event.respondWith(fetch(request).catch(() => caches.match('/', { cacheName: SHELL })));
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
    // The reader's engine: its names change with its content, so a kept copy is always right.
    if (/\/_expo\/static\/js\/web\/pdf-[0-9a-f]+\.js$/.test(url.pathname)) {
      event.respondWith(
        caches.open(READER).then(async (cache) => {
          const hit = await cache.match(request);
          if (hit) return hit;
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone()).then(() => trim(cache, 4));
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

// Push notifications (supabase/functions/push-send): shown even with the app closed; a tap opens
// the screen they are about, in the open app if there is one.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'ORAL', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      tag: data.id || data.tag || 'oral',
      lang: 'fr',
      data: { link: data.link || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  const url = new URL('' + (link.startsWith('/') ? link : '/' + link), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin + '/') && !LEAVE.some((path) => new URL(w.url).pathname.startsWith(path)));
      if (open) return open.focus().then((w) => (w && 'navigate' in w ? w.navigate(url) : w));
      return self.clients.openWindow(url);
    }),
  );
});
