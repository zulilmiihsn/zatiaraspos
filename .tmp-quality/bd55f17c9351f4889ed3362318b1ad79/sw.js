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
    "url": "_app/immutable/assets/pinModal.DoI3ASAw.css",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/7xE67wvV.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/8t9FExsQ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/9LUqZvlM.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/aiiqPFh5.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/ay8avWeL.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B25cK49v.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B7959yiO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BaQDUufv.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BbLQCrIA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BDqUnOnG.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BDy0ocY2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BFXTkvK_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bgz4rNwP.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BI6ZA-3C.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bizxz8-T.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BlalHANn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BltR757s.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bpav724J.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BPDlK_0x.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BReHkbCf.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C-OwFUQH.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C23Voxr_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CaQ0VK2H.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CDyA-Thx.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CEovTkS6.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CfBAODIN.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CGCRhsvu.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CHIOLmzc.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Ci0oBRDG.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CJJe0v1g.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CMe-wlUM.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CmIXG4jZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CMX9rOnl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/COvn9nVN.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CqaZlY3R.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CqCDd1iI.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CRQxkHM0.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CU0J6WKN.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CUNN-iEK.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CWVIrHH7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CzH3wDsH.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D2BxUXZ9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D5AAM9Hx.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D866S7N2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D8RB-lBJ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D9uNfqv9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBavZ5B7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DdUOmiPc.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dg3eyhu3.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DG9Xa1Ds.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DGNRs-Rm.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DkF6MdVG.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DMXp7Fa7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DozKAdsN.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DQMzpJ0w.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DThbg61m.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DyuQ9ycu.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/f6nZoE4E.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/HWZptFZZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/J21HrsJO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/mezS4JkV.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/PaEDsjn-.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/qqBpgrzW.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/SXZPxBXB.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/WWadSEKn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/X7E7gN9j.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/XwSB1vLS.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/YY4ZeN0K.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Z4qEnD15.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/app.E_g0DqR5.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/start.BSCfoNyD.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/0.D0yumgod.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/1.Cq7s9Hfu.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/10.DV_b0tA8.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/11.c2pMAKYf.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/12.BITyipiy.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/13.BW6YeJUg.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/14.C2Ke74V7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/15.DnS1mXaa.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/16.C9QujfO9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/17.Dzi96R-j.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/18.BtzVDnim.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/19.DtVyTjPZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/2.BaFlG3b8.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/3.Bhv3C8c7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/4.BZDuEXND.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/5.CD-Iunx9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/6.BBrwzrkj.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/7.DVt07cGA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/8.Dz4zlv5R.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/9.CI6WrpTV.js",
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
    "revision": "091f7246c9030beaf4399ffaa2926bb5"
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




