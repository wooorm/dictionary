'use strict';

var win = require('global/window');
var doc = require('global/document');
var PouchDB = require('pouchdb');
var createElement = require('virtual-dom/create-element');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var debounce = require('debounce');
var render = require('./render');

var db = new PouchDB({name: 'words', size: 100});

var nav = win.navigator;
var XMLHttpRequest = win.XMLHttpRequest;
var slot = doc.getElementsByTagName('main')[0];
var data = JSON.parse(doc.currentScript.previousElementSibling.textContent);
var evs = {onsubmit: onsubmit, oninput: debounce(oninput, 300)};
var tree = render(null, data, evs);
var dom = createElement(tree);
var tail;

slot.parentNode.replaceChild(dom, slot);
tail = dom.lastChild.lastChild;

win.addEventListener('dblclick', ondoubleclick);

win.onpopstate = onpopstate;

if (data) {
  store(data.word, data);
}

/* Not cached by service worked, so it sent `/`.
 * Update. */
if (doc.location.pathname !== '/' && !data) {
  onpopstate();
}

slot = data = null; /* free memory */

if ('serviceWorker' in nav) {
  nav.serviceWorker
    .register('/worker.js')
    .then(function () {
      console.info('Registered service worker');
    }, console.error.bind(console));
}

function update(next) {
  dom = patch(dom, diff(tree, next));
  tail = dom.lastChild.lastChild;
  tree = next;
}

function onsubmit(ev) {
  ev.preventDefault();
  word(ev.target.word.value);
}

function oninput(ev) {
  word(ev.target.value);
}

function word(value) {
  win.history.pushState(null, null, encodeURIComponent(value) || '/');
  change(value);
}

function ondoubleclick() {
  setTimeout(delayed, 4);

  function delayed() {
    var sel = win.getSelection();
    var node = sel.anchorNode;
    var value;

    if (node !== sel.focusNode || node.nodeType !== doc.TEXT_NODE) {
      return;
    }

    value = node.data.slice(sel.anchorOffset, sel.focusOffset);

    if (!/[^A-Za-z0-9'’-]/.test(value)) {
      dom.firstChild.firstChild.value = value;
      word(value);
    }
  }
}

function onpopstate() {
  var value = doc.location.pathname.slice(1);
  dom.firstChild.firstChild.value = value;
  change(value);
}

function change(value) {
  var area = dom.lastChild;
  var current = area.firstChild;

  doc.title = value || 'Dictionary';

  if (!value) {
    update(render(null, null, evs));
    return;
  }

  if (current === tail) {
    current = doc.createElement('div');
    current.className = 'spinner';
    area.replaceChild(current, tail);
  }

  load(value, onword);

  function onword(err, data) {
    area.replaceChild(tail, current);
    update(render(err, data, evs));
  }
}
function load(value, callback) {
  var word = String(value).toLowerCase();
  var connection;

  db.get(word, local);

  setTimeout(check, 300);

  /* There’s a bug in Safari where, when navigating back from somewhere
   * else to our app, the database hangs (indefinitely).
   * Force reload when that happens. */
  function check() {
    if (!connection) {
      console.warn('Forcing reload after unresponsive database.');
      win.location.reload();
    }
  }

  function local(_, doc) {
    connection = true;

    if (doc) {
      callback(null, doc.data);
    } else {
      remote();
    }
  }

  function remote() {
    var request = new XMLHttpRequest();
    var err;

    request.open('GET', '/api/' + encodeURIComponent(value));
    request.onerror = onerror;
    request.onload = onload;
    request.send();

    function onerror() {
      err = new Error('Cannot connect to API');
      err.code = 'dict:offline';
      callback(err);
    }

    function onload() {
      var result;

      if (this.status === 404) {
        result = {word: word, found: false};
      } else {
        try {
          result = JSON.parse(this.response);
        } catch (err) {
          return onerror();
        }
      }

      callback(null, result);
      store(word, data);
    }
  }
}

function store(id, data) {
  db.put({_id: id, data: data}, onput);

  function onput(err) {
    if (err && err.name !== 'conflict') {
      console.error('Could not store `%s` in database', id);
    }
  }
}
