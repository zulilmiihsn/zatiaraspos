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
    "url": "_app/immutable/assets/0.AaiJM70T.css",
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
    "url": "_app/immutable/chunks/_6OhqDKw.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/-Gzr6aI6.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B3P3Hua7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BbLQCrIA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bc2RVuSV.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bc6lSsvE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BCweidYv.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BDy0ocY2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bf-fXUqj.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bizxz8-T.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BmAkr4f6.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BpcajF7T.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BReE8CTv.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BZXbmsoV.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CaQ0VK2H.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CeYp5LcR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cf17drEj.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CfPADWEW.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CfRqF6ki.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cgh3QNOR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CJc0RX_p.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/cJZmzVWy.js",
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
    "url": "_app/immutable/chunks/CPSG77Pz.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CQ8K8j6w.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CWWsJFeg.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CY6zLBMS.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CyV8qK26.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CYWwChxY.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D_wAE6uY.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D-c9b2fU.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D-pvSDuM.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D0pFLhcg.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D2BxUXZ9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D2M1zZ04.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D8QbgMSE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D8ty_STX.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBavZ5B7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBsxyvt3.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dbw_AT1_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DEv64lpl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DG9Xa1Ds.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DHJDk4Ix.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DL-nuVh-.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DMXp7Fa7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DnqROK5U.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DOao1TZM.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DSel7ExN.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DSGLg6Xj.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DThbg61m.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DXa-vG8O.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DybrISrS.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DZI4yPqq.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/ez2yM-r0.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/GG6uC7g_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/IMEWGbZE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/iq_MMq36.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/IxgdJlal.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/J21HrsJO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/mquj0I39.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/OE1lO6RJ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/qdfWvJw2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/qgAH8IE6.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/qqBpgrzW.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/qutJK7yS.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/WWadSEKn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/yOkOhNU-.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/yQ9yjgKn.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/app.BiBZPAMA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/start.B_eU9M8u.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/0.p0CmA5KF.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/1.fnNkOLuO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/10.BVdA7tC5.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/11.CD5qb12n.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/12.Buy84G3Z.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/13.mvQQclCM.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/14.CK77WfyE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/15.-AUWWUdH.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/16.BcxI0DYY.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/17.cdCCku3w.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/18.BaeTOHSl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/19.D-kJ_WpA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/2.CvKUC1ET.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/3.C4bXzeCz.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/4.u7Bq37PJ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/5.zRBh70YC.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/6.UdEbcyNF.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/7.DK7S-BAm.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/8.CZddUQG7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/9.CzBa8WY4.js",
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
    "revision": "dee03bcafdff7e7e8a4a06c2702458a0"
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




