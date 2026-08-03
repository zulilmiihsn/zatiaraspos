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
    "url": "_app/immutable/assets/0.CpWdzNq7.css",
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
    "url": "_app/immutable/assets/18.G3cFnn5d.css",
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
    "url": "_app/immutable/assets/modalSheet.DU767-C4.css",
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
    "url": "_app/immutable/chunks/_5ItdhT2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/_86GfFHp.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/10pmeaxe.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/1hcxfFkZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/3PE9REhi.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/4rHhAaSg.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/6orjJkSs.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B0_oWy6g.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B4obvHVb.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B6jjEJQY.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B9m_R6nv.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BbLQCrIA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BCweJJ9w.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BDy0ocY2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BFEtjFy2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bizxz8-T.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bl2niciX.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BLqWq20_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BpHOtVGD.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Brnv3sqk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BrQkrws2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BtUrTUxJ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BvZCxORP.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BWgLwOd6.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C_pSmKjg.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C-2cavQ3.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C0MHXyCE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C9EYV4g5.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CaQ0VK2H.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/cb1NAsim.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cc2HkgOK.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CcF9IkOy.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CDg_0Z-U.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CHftdoIG.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CmInpSxs.js",
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
    "url": "_app/immutable/chunks/CS4_YKyj.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CUXaadCJ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CuXnp6lT.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CvHcBO-Y.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CVj4lb2z.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CyUilU6u.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D2BxUXZ9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D3qAell8.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D3Wr7IBx.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D9pjj9ol.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBavZ5B7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DEv64lpl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Df5F0i9i.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DfAhN4xB.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dfne2J8R.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DG9Xa1Ds.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DKE4LPjY.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DMqgVl7Z.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dr8eB9O-.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DThbg61m.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dy4AqlIf.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DyyX2cTp.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/E35R2e4a.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/enZuy-zx.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/F021dmGT.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/iMq4vn-Z.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/J21HrsJO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/nBzPh0xk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/O8poId7H.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/rbxi2G1m.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/s8Oo4wtR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/ugI84wDg.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/WWadSEKn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/XSzfPW8T.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/app.AXzV_uLE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/start.Cm-S0Wll.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/0.TmE3gqsn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/1.cKFelsx5.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/10.CILsVzya.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/11.AYKzUNbL.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/12.C5-JhcCk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/13.DlpBoKJX.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/14.DyJWjOfy.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/15.42ooRvcP.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/16.BHPOGo86.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/17.sccAs1Ti.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/18.Bw_z0yYa.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/19.CM7mUtXg.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/2.ChyF6VBe.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/3.wI0xKqrF.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/4.DxdqwwI-.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/5.DXv48cdw.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/6.COsgEbqr.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/7.DfdDd2rn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/8.BegLryIR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/9.B-ej0_Ea.js",
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
    "revision": "0c535bb4d49240cbc12461f8043ea284"
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




