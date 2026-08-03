import {registerRoute as workbox_routing_registerRoute} from 'D:/Projects/zatiaraspos/node_modules/.pnpm/workbox-routing@7.3.0/node_modules/workbox-routing/registerRoute.mjs';
import {CacheableResponsePlugin as workbox_cacheable_response_CacheableResponsePlugin} from 'D:/Projects/zatiaraspos/node_modules/.pnpm/workbox-cacheable-response@7.3.0/node_modules/workbox-cacheable-response/CacheableResponsePlugin.mjs';
import {ExpirationPlugin as workbox_expiration_ExpirationPlugin} from 'D:/Projects/zatiaraspos/node_modules/.pnpm/workbox-expiration@7.3.0/node_modules/workbox-expiration/ExpirationPlugin.mjs';
import {PrecacheFallbackPlugin as workbox_precaching_PrecacheFallbackPlugin} from 'D:/Projects/zatiaraspos/node_modules/.pnpm/workbox-precaching@7.3.0/node_modules/workbox-precaching/PrecacheFallbackPlugin.mjs';
import {NetworkFirst as workbox_strategies_NetworkFirst} from 'D:/Projects/zatiaraspos/node_modules/.pnpm/workbox-strategies@7.3.0/node_modules/workbox-strategies/NetworkFirst.mjs';
import {StaleWhileRevalidate as workbox_strategies_StaleWhileRevalidate} from 'D:/Projects/zatiaraspos/node_modules/.pnpm/workbox-strategies@7.3.0/node_modules/workbox-strategies/StaleWhileRevalidate.mjs';
import {precacheAndRoute as workbox_precaching_precacheAndRoute} from 'D:/Projects/zatiaraspos/node_modules/.pnpm/workbox-precaching@7.3.0/node_modules/workbox-precaching/precacheAndRoute.mjs';
import {cleanupOutdatedCaches as workbox_precaching_cleanupOutdatedCaches} from 'D:/Projects/zatiaraspos/node_modules/.pnpm/workbox-precaching@7.3.0/node_modules/workbox-precaching/cleanupOutdatedCaches.mjs';/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */








self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});




/**
 * The precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
workbox_precaching_precacheAndRoute([
  {
    "url": "_app/immutable/assets/0.DnZ5b67W.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/13.BzVx9ScF.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/14.DYiBpotG.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/16.CJSWm68C.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/17.CznhOLNa.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/18.DIWYZIsz.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/2.CnAgU3nG.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/3.CdXyLdrc.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/4.DSEvsb8k.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/5.PWb0YfyC.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/8.BDDvLRpv.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/9.CUW96be9.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/dropdownSheet.9G_mXaZp.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/modalSheet.CMc5_l6L.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/NotifModal.BKO4f0ki.css",
    "revision": null
  },
  {
    "url": "_app/immutable/assets/pinAccessService.DoI3ASAw.css",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/5I5bXZSZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/7cYgoCxn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/9-RdT8LB.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B_I7qVWG.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B0MvJpJ0.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B4un-Riz.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B7KMH4u2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B9wYlt-9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BbLQCrIA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BDy0ocY2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Becq6qgx.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BfNOQrM0.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bi1iA5F7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bizxz8-T.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BN9JwNvk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BT-ACj7p.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/bvQIhanh.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BWwa4A5r.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bx-XRcWZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BXRJfiXT.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BY9tTaYD.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C_2-SQWI.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C4jlR-zC.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C7RemP_u.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CabA23Ci.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CaQ0VK2H.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/cCHiUvZu.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Ch4IPA5X.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CmeQQcZH.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CmIXG4jZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/COvn9nVN.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cpe0sh_a.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CqEjrHNz.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CR-EXjg7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CRQxkHM0.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cs9R5bjQ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Csk5tBIy.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CWzXE0bk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D0qOmr_X.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D17SkfUI.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D2BxUXZ9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D2oWvv6Z.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBavZ5B7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBd5fg34.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DG9Xa1Ds.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DGJnq-Mu.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DJ54Mh34.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DKnsXdIw.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DLvZib03.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DMDKKU5b.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DMXp7Fa7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DN1EbPH9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DQoeEu2c.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DThbg61m.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DuGHVVLH.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DutQsaUr.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DwgCrDOS.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DwiyHEOR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DYAXrOdU.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/J21HrsJO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/LRRQW5B-.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/mwCkt3GM.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/pUq9fyoY.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/qqBpgrzW.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/sPX5gJt9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/TvCH4C3W.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/wTErBgQX.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/WWadSEKn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Yh63zcd0.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/app.B0ssHKB9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/start.CA8doasl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/0.Cm4hlx_F.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/1.CMy5rFwb.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/10.D6b6qXX4.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/11.DNyHS4YI.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/12.CV3iJiEj.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/13.D76HAAdU.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/14.zJyrSVKj.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/15.BNPUL7lO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/16.CjWoX5fc.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/17.M7bytpUA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/18.D2IN4PTv.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/19.BaGmknQ_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/2.B6g9_AM0.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/3.Lgl94wNm.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/4.D_oQPM5x.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/5.MUl_fD6y.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/6.DXiDJEKZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/7.DZTpPuil.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/8._lW2Ertd.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/9.Cqz49rpR.js",
    "revision": null
  },
  {
    "url": "favicon.svg",
    "revision": "fbd3f55c5dc7b2eac7ca7193e84bb88c"
  },
  {
    "url": "img/144x144.png",
    "revision": "74a0d251fdfd5129630d5449ed3ce997"
  },
  {
    "url": "img/180x180.png",
    "revision": "caeae4ae2c5ecbbcae0fa47e84bbf7d4"
  },
  {
    "url": "img/192x192.png",
    "revision": "7eb4bb52d38e286cd417cb955eecb874"
  },
  {
    "url": "img/512x512.png",
    "revision": "08e8698edd08425105165172755487c8"
  },
  {
    "url": "img/logo.svg",
    "revision": "fbd3f55c5dc7b2eac7ca7193e84bb88c"
  },
  {
    "url": "manifest.webmanifest",
    "revision": "26b20ff5a2bafc022654854a3bafe33a"
  },
  {
    "url": "offline",
    "revision": "36862fb81d50ab313fd0cedcd4afaf01"
  },
  {
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  },
  {
    "url": "offline",
    "revision": "ecfb5b291191478f1211f858593cd96c"
  },
  {
    "url": "favicon.svg",
    "revision": "fbd3f55c5dc7b2eac7ca7193e84bb88c"
  },
  {
    "url": "manifest.webmanifest",
    "revision": "26b20ff5a2bafc022654854a3bafe33a"
  }
], {});
workbox_precaching_cleanupOutdatedCaches();



workbox_routing_registerRoute(({ request, url }) => request.mode === "navigate" && /^\/pos(?:\/|$)/.test(url.pathname), new workbox_strategies_NetworkFirst({ "cacheName":"pos-navigation-v1","networkTimeoutSeconds":3, plugins: [new workbox_cacheable_response_CacheableResponsePlugin({ statuses: [ 0, 200 ] }), new workbox_expiration_ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 86400 }), new workbox_precaching_PrecacheFallbackPlugin({ fallbackURL: '/offline' })] }), 'GET');
workbox_routing_registerRoute(/\.(?:png|jpg|jpeg|svg|webp|avif)$/, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"images-cache", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 1209600 })] }), 'GET');
workbox_routing_registerRoute(/\.(?:woff2?|ttf|otf)$/, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"fonts-cache", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 2592000 })] }), 'GET');




