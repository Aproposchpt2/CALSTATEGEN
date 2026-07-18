'use strict';
// CalGCC — weighted concept-tag matching layer.
// Normalizes free text (capability keywords or opportunity title/description),
// tags it against /data/concept-dictionary.json's synonym clusters, and scores
// overlap between a business profile and an opportunity with rarer/more
// specific concepts weighted higher than generic ones (inverse document
// frequency across the current opportunity dataset — not true TF-IDF).
//
// Loaded as a plain <script> (no bundler on this site), so everything hangs
// off a single global: window.ConceptMatch.

(function (global) {
  // Note: "it" is deliberately NOT a stopword here — in government-contracting
  // text it almost always means Information Technology ("IT services", "IT
  // consulting"), not the pronoun. Stripping it collapsed those synonym
  // phrases down to just "consulting"/"services" and caused false-positive
  // matches on unrelated engineering/construction bids.
  var STOPWORDS = {
    'a':1,'an':1,'and':1,'are':1,'as':1,'at':1,'be':1,'by':1,'for':1,'from':1,
    'in':1,'into':1,'is':1,'of':1,'on':1,'or':1,'that':1,'the':1,'to':1,
    'with':1,'this':1,'these':1,'those':1,'will':1,'shall':1,'may':1,'can':1,
    'services':1,'service':1,'and/or':1,'per':1,'all':1,'any':1
  };

  function normalizeText(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Light suffix-stripping stemmer — not full Porter, just enough to collapse
  // common inflections (engineer/engineering/engineers, consult/consulting)
  // so both sides of a comparison land on the same token consistently.
  function lightStem(word) {
    if (word.length > 4 && /ies$/.test(word)) return word.slice(0, -3) + 'y';
    if (word.length > 4 && /(ing)$/.test(word)) return word.slice(0, -3);
    if (word.length > 6 && /tion$/.test(word)) return word.slice(0, -4);
    if (word.length > 6 && /ment$/.test(word)) return word.slice(0, -4);
    if (word.length > 4 && /ed$/.test(word)) return word.slice(0, -2);
    if (word.length > 4 && /ly$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && /es$/.test(word) && !/ss$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && /s$/.test(word) && !/ss$/.test(word)) return word.slice(0, -1);
    return word;
  }

  function tokenize(text) {
    var norm = normalizeText(text);
    if (!norm) return [];
    return norm.split(' ')
      .filter(function (w) { return w && !STOPWORDS[w]; })
      .map(lightStem);
  }

  // A synonym phrase matches if every stemmed token in the phrase appears
  // somewhere in the stemmed token set of the input text (order-independent,
  // handles pluralization/inflection on both sides).
  //
  // Guard: if the phrase was written as multiple words but stopword removal
  // collapsed it down to a single surviving token, refuse to match on that
  // lone token — its discriminating power came from the word that got
  // filtered out. Without this, phrases like "it services" silently degrade
  // to just "it" (a 2-letter token that collides with e.g. "Non-IT") once
  // "services" is dropped as a stopword. Single-word synonyms are unaffected.
  function phraseMatches(phrase, stemSet) {
    var wordCount = normalizeText(phrase).split(' ').filter(Boolean).length;
    var tokens = tokenize(phrase);
    if (!tokens.length) return false;
    if (wordCount > 1 && tokens.length < 2) return false;
    for (var i = 0; i < tokens.length; i++) {
      if (!stemSet.has(tokens[i])) return false;
    }
    return true;
  }

  // Returns the array of matched concept-tag keys for a text string.
  function tagText(text, dictionary) {
    var stems = tokenize(text);
    if (!stems.length) return [];
    var stemSet = new Set(stems);
    var tags = [];
    var concepts = (dictionary && dictionary.concepts) || {};
    for (var tag in concepts) {
      var synonyms = concepts[tag].synonyms || [];
      for (var i = 0; i < synonyms.length; i++) {
        if (phraseMatches(synonyms[i], stemSet)) { tags.push(tag); break; }
      }
    }
    return tags;
  }

  // Simple inverse-frequency weighting across the current opportunity dataset:
  // weight(tag) = totalDocs / docFreq(tag), with unseen tags treated as
  // maximally rare (weight = totalDocs) rather than infinite/NaN.
  function computeIdfWeights(taggedDocs) {
    var totalDocs = Math.max(1, taggedDocs.length);
    var docFreq = {};
    taggedDocs.forEach(function (tags) {
      var seen = {};
      tags.forEach(function (t) {
        if (seen[t]) return;
        seen[t] = 1;
        docFreq[t] = (docFreq[t] || 0) + 1;
      });
    });
    return {
      weightOf: function (tag) {
        var df = docFreq[tag] || 0;
        return totalDocs / Math.max(1, df);
      },
      docFreq: docFreq,
      totalDocs: totalDocs
    };
  }

  // Weighted overlap score between a profile's concept tags and a single
  // opportunity's concept tags.
  function scoreOverlap(profileTags, bidTags, idf) {
    if (!profileTags.length || !bidTags.length) return 0;
    var bidSet = new Set(bidTags);
    var score = 0;
    profileTags.forEach(function (tag) {
      if (bidSet.has(tag)) score += idf.weightOf(tag);
    });
    return score;
  }

  global.ConceptMatch = {
    normalizeText: normalizeText,
    lightStem: lightStem,
    tokenize: tokenize,
    tagText: tagText,
    computeIdfWeights: computeIdfWeights,
    scoreOverlap: scoreOverlap
  };
})(window);
