'use strict'

var h = require('virtual-dom/h')

module.exports = render

function render(err, data, evs) {
  var contents

  if (err) {
    if (err.code === 'dict:offline') {
      contents = h('.dictionary-err', {key: 'err-offline'}, [
        'Cannot look up definition. Connect to the internet and try again.'
      ])
    } else {
      contents = h('.dictionary-err', {key: 'err'}, [
        h('pre', {key: 'err-stack'}, err.stack)
      ])
    }
  } else if (data && data.found === false) {
    contents = h('p.dictionary-404', {key: '404'}, ['Not found in dictionary.'])
  } else if (data) {
    try {
      contents = [syllables(data.syllables), definitions(data.results)]
    } catch (error) {
      contents = h('.dictionary-err', {key: 'err'}, [
        h('pre', {key: 'err-stack'}, error.stack)
      ])
    }
  } else {
    contents = h('p.dictionary-placeholder', {key: 'placeholder'}, [
      'Search for something!'
    ])
  }

  return h('main', {key: 'main'}, [
    h('form', {key: 'form', action: '/', onsubmit: evs && evs.onsubmit}, [
      h('input', {
        type: 'search',
        name: 'word',
        key: 'input',
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        spellcheck: false,
        autofocus: true,
        placeholder: 'Search…',
        attributes: {value: data ? data.word : ''},
        onclick: onclick,
        oninput: evs && evs.oninput
      }),
      h('button', {key: 'submit', type: 'submit'}, ['Define'])
    ]),
    h('.dictionary', {key: 'dictionary'}, [
      h('div', {key: 'contents'}, [head(data)].concat(contents))
    ])
  ])

  function onclick(ev) {
    var node = ev.target
    node.selectionStart = 0
    node.selectionEnd = node.value.length
  }
}

function head(data) {
  var word = data && data.word
  var pronunciation = data && data.pronunciation
  var nodes = []

  if (word) {
    nodes.push(h('strong', {key: 'term'}, [word]))
  }

  if (pronunciation && typeof pronunciation !== 'string') {
    pronunciation = pronunciation.all
  }

  if (pronunciation) {
    nodes.push(
      ' ',
      h('span.dictionary-pronounciation.ipa', {key: 'pronounciation'}, [
        pronunciation
      ])
    )
  }

  return nodes.length === 0
    ? null
    : h('h1.dictionary-entry', {key: 'head'}, nodes)
}

function syllables(data) {
  var nodes = []

  if (!data) {
    return
  }

  nodes = [
    h('em', {key: 'syllable-label'}, ['Syllables']),
    ': ',
    h('em', {key: 'syllable-count'}, [String(data.count)])
  ]

  data.list.forEach(addSyllable)
  nodes.push('.')

  return h('h2.dictionary-definition', {key: 'syllables'}, nodes)

  function addSyllable(syllable, index) {
    nodes.push(
      index ? '·' : ' — ',
      h('em', {key: 'syllable-' + syllable}, [syllable])
    )
  }
}

function definitions(data) {
  if (data && data.length !== 0) {
    return h(
      'ol.dictionary-definitions',
      {key: 'definitions'},
      data.map(definition).filter(Boolean)
    )
  }

  return h('p.dictionary-empty', {key: 'definitions-empty'}, [
    'No known definitions.'
  ])
}

function definition(data, index) {
  var id = 'definition-' + index
  return h('li', {key: id}, [
    title(data, id),
    h('p', {key: id + '-definition'}, pretty(data.definition)),
    list('Member of', data.memberOf, id + '-member'),
    list('Examples', data.examples, id + '-examples'),
    list('Synonyms', data.synonyms, id + '-synonyms'),
    list('Antonyms', data.antonyms, id + '-antonyms'),
    list('Similar', data.similarTo, id + '-similar')
  ])
}

function title(data, id) {
  var derivation
  var nodes = []

  if (data.partOfSpeech) {
    nodes.push(h('strong', {key: id + '-pos'}, [data.partOfSpeech]))
  }

  if (data.typeOf) {
    nodes.push(' (')
    data.typeOf.forEach(add(id + '-type'))
    nodes.push(')')
  }

  derivation = data.derivation

  if (derivation) {
    if (typeof derivation === 'string') {
      derivation = [derivation]
    }

    if (derivation) {
      nodes.push(', derived from: ')
      derivation.forEach(add(id + '-derivative'))
    }
  }

  if (nodes.length === 0) {
    return null
  }

  return h('h2.dictionary-definition', {key: id + '-title'}, nodes.concat('.'))

  function add(subId) {
    return fn
    function fn(subvalue, index) {
      nodes.push(
        index ? ', ' : null,
        h('em', {key: subId + '-' + index}, subvalue)
      )
    }
  }
}

function list(label, data, id) {
  if (!data || data.length === 0) {
    return
  }

  return h('div', {key: id}, [
    h('h3.dictionary-list-label', {key: id + '-label'}, [label]),
    h('ol.dictionary-list', {key: id + '-list'}, data.map(item))
  ])

  function item(value, index) {
    return h('li', {key: id + '-' + index}, [value])
  }
}

function pretty(value) {
  return value.replace(/`(\w+)'/g, '“$1”')
}
