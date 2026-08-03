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
    "url": "_app/immutable/assets/8.6XL-uZxs.css",
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
    "url": "_app/immutable/chunks/BbLQCrIA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bcm64JvD.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BEC6VtOH.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BI3a7VDc.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bizxz8-T.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BlrSV9Pq.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BlX8aE2O.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BnbEmHHZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BNdC1YNt.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BNo6zYgn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bt1Ofjqv.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BUWVFSaQ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BWW_XC47.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BxG2mYJO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BZCQ7jp9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C9gHgTdR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CaJHeIEJ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CaQ0VK2H.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CHz0xtWl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CIyJYXtu.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CLzFcWiE.js",
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
    "url": "_app/immutable/chunks/Cp9usKWi.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cr9VvYUl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CrQxjaiX.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cu2PDmFR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CXGrIFf1.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CYzJp6ez.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CZCfnOVP.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CzgdGhSu.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D2BxUXZ9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D7LvkfdF.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DABS8q0_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBavZ5B7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBqDd8Sv.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DEv64lpl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DfNZntrS.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DG9Xa1Ds.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Diaukvpk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DiUQjtY6.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DjSmvt8H.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DK3rn6wv.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DMXp7Fa7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DqqN5a6J.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dr-dbUGk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DSbQvMTZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DsTGYQhB.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DtKXrJqu.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DWgwJvGR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DYiG7uHA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dz-BeZi6.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/gYMF89VM.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/isJ6MUM8.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/J21HrsJO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/K1M6zqW-.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/K7m2QX-2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/M_DV0Vrd.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/QIcz0Nhp.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/SjfpKY-c.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/vf3aEK5F.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/WWadSEKn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/app.CB656t1p.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/start.BQNj7Hsq.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/0.D7Cxy_as.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/1.iticgiBG.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/10.Cxf9P6Pl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/11.C3DfO0SD.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/12.Dfg0cUwK.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/13.B7qNl-NF.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/14.21AJXBGU.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/15.B7AV6QIk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/16.Z4z8BWgI.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/17.DuPfRf61.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/18.l2TTaGT2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/19.054vN1Tr.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/2.MSD2hcWz.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/3.CiT3g-mS.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/4.D3BAqajF.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/5.C-VB5dWW.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/6.CE-uWW3M.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/7.CfR3O87v.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/8.BbnVodII.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/9.CeNGJ4tT.js",
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
    "revision": "3b2cd7e03b7240db284f387ded39c891"
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




