'use strict'

/* global self caches URL fetch */

var version = '0'
var prefix = 'dictionary'
var staticCacheName = [prefix, 'static', version].join('-')
var staticFiles = [
  '/',
  '/static/index.js',
  '/static/index.css',
  '/static/manifest.json'
]

self.addEventListener('install', oninstall)
self.addEventListener('activate', onactivate)
self.addEventListener('fetch', onfetch)

function oninstall(ev) {
  ev.waitUntil(caches.open(staticCacheName).then(oncache))

  function oncache(cache) {
    return cache.addAll(staticFiles)
  }
}

/* Clear previous caches. */
function onactivate(ev) {
  ev.waitUntil(caches.keys().then(onkeys))

  function onkeys(keys) {
    return Promise.all(keys.map(remove))
  }

  function remove(key) {
    if (key.indexOf(prefix + '-') === 0 && key !== staticCacheName) {
      return caches.delete(key)
    }
  }
}

/* Clear previous caches. */
function onfetch(ev) {
  var request = ev.request
  var url = new URL(request.url)

  ev.respondWith(
    caches
      .match(request)
      .then(onresponse)
      .catch(onuncached)
  )

  function onresponse(response) {
    if (response) {
      console.log('Returning cached response for %s', url.pathname)
      return response
    }

    console.log('Fetching uncached response for %s', url.pathname)

    return Promise.race([
      fetch(request),
      new Promise(function(resolve, reject) {
        setTimeout(reject.bind(null, new Error('Fetch timeout')), 5000)
      })
    ]).then(save)
  }

  function onuncached(err) {
    var pathname = url.pathname

    /* Send `/` if this looks like `/:word`.
     * `build.js` will kick in and try `pouchdb`. */
    if (
      staticFiles.indexOf(pathname) === -1 &&
      pathname.lastIndexOf('/') === 0 &&
      pathname.indexOf('.') === -1 &&
      request.method === 'GET'
    ) {
      return caches.match('/')
    }

    throw err
  }

  function save(response) {
    caches.open(staticCacheName).then(oncache)

    /* Return early. */
    return response.clone()

    function oncache(cache) {
      console.log('Cached response for %s', url.pathname)
      return cache.put(request, response)
    }
  }
}
