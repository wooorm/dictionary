'use strict';

var path = require('path');
var url = require('url');
var https = require('https');
var express = require('express');
var levelup = require('levelup');
var leveldown = require('leveldown');
var concat = require('concat-stream');
var xtend = require('xtend');
var compression = require('compression');
var toString = require('vdom-to-html');
var render = require('./lib/render');

var db = levelup(leveldown('words-db'));

require('dotenv').config();

var key = process.env.WORDSAPI_KEY;

if (!key) {
  throw new Error('Missing `WORDSAPI_KEY` in env.');
}

var endpoint = 'https://wordsapiv1.p.mashape.com';
var headers = {Accept: 'application/json', 'X-Mashape-Key': key};

express()
  .use(compression())
  .use('/static', express.static('public', {maxAge: '31d'}))
  .use('/worker.js', worker)
  .get('/api/:word', word)
  .get('/', home)
  .get('/:word', entry)
  .listen(2000);

function worker(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'worker.js'));
}

function word(req, res) {
  load(req.params.word, callback);

  function callback(err, buf) {
    if (err) {
      res.emit('error', err);
    } else {
      res.set('Content-Type', 'application/json');
      res.end(String(buf));
    }
  }
}

function entry(req, res) {
  var val = decodeURIComponent(req.params.word);

  load(val, callback);

  function callback(err, buf) {
    respond(res, err, buf ? JSON.parse(buf) : {word: val, found: false});
  }
}

function home(req, res) {
  if (req.query.word) {
    res.redirect('/' + req.query.word);
  } else {
    respond(res);
  }
}

function respond(res, err, data) {
  var doc = toString(render(err, data));
  var source = data ? JSON.stringify(data) : 'null';

  res.set('Content-Type', 'text/html');
  res.set('Cache-Control', 'public, max-age=2678400');
  res.end([
    '<!doctype html>',
    '<html lang="en">',
    '<meta charset="utf-8">',
    '<meta name="theme-color" content="#d605d6">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<link rel="shortcut icon" type="image/x-icon" href="data:image/x-icon;,">',
    '<link rel="manifest" href="/static/manifest.json">',
    '<title>Dictionary</title>',
    '<link rel="stylesheet" href="/static/index.css">',
    '<body class="nojs">',
    '<script>document.body.className = \'js\';</script>',
    doc,
    '<footer>',
    '<p><a href="https://github.com/wooorm/dictionary/blob/master/LICENSE"><abbr title="Massachusetts Institute of Technology (license)">MIT</abbr></a> © <a href="http://wooorm.com">wooorm</a>',
    '</footer>',
    '<script type="text/json">' + source + '</script>',
    '<script src="/static/index.js"></script>',
    ''
  ].join('\n'));
}

function load(value, callback) {
  var word = String(value).toLowerCase();

  db.get(word, local);

  function local(_, buf) {
    if (buf) {
      callback(null, buf);
    } else {
      console.log('Could not find `%s` in database', word);
      https.get(xtend(url.parse(endpoint + '/words/' + word), {headers: headers}), onresponse);
    }
  }

  function onresponse(response) {
    response.on('error', callback).pipe(concat(onconcat));

    function onconcat(buf) {
      if (response.statusCode !== 200) {
        console.log('Could not find `%s` on remote', word);
        buf = JSON.stringify({word: word, found: false});
      }

      db.put(word, buf, ondone);

      function ondone() {
        callback(null, buf);
      }
    }
  }
}
