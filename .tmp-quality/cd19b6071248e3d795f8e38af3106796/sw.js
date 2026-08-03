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
    "url": "_app/immutable/assets/0.CBFkV8c4.css",
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
    "url": "_app/immutable/assets/pinModal.DoI3ASAw.css",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/3y4QzH7y.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/B_WjmBtI.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BbLQCrIA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BC65Xy00.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BCfbdJ-X.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BE8nu4pN.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bizxz8-T.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BmcP-IkE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Boxpr1he.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BSD243jQ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BU0T-yWA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bvs82Syk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Bw6rlEuC.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/BwsWvRJR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C1jg5TCi.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/C4urI_65.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cjv35LJA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CmIXG4jZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CNCKCYWO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CNRYyIVE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/COP4S6dB.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/COvn9nVN.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cp2LobHT.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CpxzH2tC.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CR21sUfY.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cs3SlvSl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CtXW2nki.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CuyP6PBl.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Cw2I59kP.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CXGrIFf1.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/CXmaOkHO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D-JUkxD_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D2BxUXZ9.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D3EBpCeR.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D6_30ztL.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/D9N4qWCF.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Da1he7No.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DanXgNSp.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DB3D7dEZ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DB5-sguk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DBavZ5B7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DCCQO9wk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DG9Xa1Ds.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DMXp7Fa7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DOf_s8Ct.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DtoNFZTg.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DUchlwKr.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dun7gB1g.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Dw-TKr3q.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DWYiExuB.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/DxRCIMKE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/iDlb6Mo5.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/J21HrsJO.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Od4v6wmH.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/SjfpKY-c.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/tg7j9OCA.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/tzUzuMa6.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/vBNV9z2B.js",
    "revision": null
  },
  {
    "url": "_app/immutable/chunks/Y4EUdUQk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/app.RtV7Co-_.js",
    "revision": null
  },
  {
    "url": "_app/immutable/entry/start.CaCkXf0-.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/0.Driz571g.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/1.DL8I3idH.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/10.Bf-jmKjk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/11.CCAHC1Sp.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/12.0GgXG0Tf.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/13.Cf3HuwEJ.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/14.iuiS4bDk.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/15.Cfd8b0pz.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/16.DnjV0XIY.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/17.B0zn771J.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/18.nmNJN14P.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/19.Cfly4hbV.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/2.D9EneP05.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/3.B6C9Ac0p.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/4.BqyvyjsW.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/5.CGf7ndo2.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/6.Ba-2o6D7.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/7.ufk-z91c.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/8.BL7l04uE.js",
    "revision": null
  },
  {
    "url": "_app/immutable/nodes/9.y4pFVZ4M.js",
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
    "revision": "2b2de310c45645fb63eaa2a7aee7b4a7"
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




