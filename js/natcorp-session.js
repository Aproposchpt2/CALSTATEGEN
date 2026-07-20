(function(){
  'use strict';

  var TRANSIENT_KEYS = {
    calgcc_profile: true,
    calgcc_session: true,
    natcorp_profile: true,
    natcorp_session: true,
    natcorp_handoff: true
  };

  var originalGet = Storage.prototype.getItem;
  var originalSet = Storage.prototype.setItem;
  var originalRemove = Storage.prototype.removeItem;

  function isTransient(key){
    return Boolean(TRANSIENT_KEYS[String(key || '')]);
  }

  function sessionGet(key){
    return originalGet.call(window.sessionStorage, key);
  }

  function sessionSet(key, value){
    return originalSet.call(window.sessionStorage, key, value);
  }

  function sessionRemove(key){
    return originalRemove.call(window.sessionStorage, key);
  }

  // The legacy pages still call localStorage. Redirect only the NAT-CORP
  // profile/session keys to sessionStorage so the existing flow remains intact
  // without preserving a visitor between browser sessions.
  Storage.prototype.getItem = function(key){
    if (this === window.localStorage && isTransient(key)) return sessionGet(key);
    return originalGet.call(this, key);
  };

  Storage.prototype.setItem = function(key, value){
    if (this === window.localStorage && isTransient(key)) return sessionSet(key, value);
    return originalSet.call(this, key, value);
  };

  Storage.prototype.removeItem = function(key){
    if (this === window.localStorage && isTransient(key)) return sessionRemove(key);
    return originalRemove.call(this, key);
  };

  function clearTransientState(){
    Object.keys(TRANSIENT_KEYS).forEach(function(key){
      originalRemove.call(window.localStorage, key);
      originalRemove.call(window.sessionStorage, key);
    });
  }

  // Every new intake starts clean. No prior profile, selected service, or
  // dashboard token is reused.
  var path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/intake' || path === '/intake.html') clearTransientState();
})();
