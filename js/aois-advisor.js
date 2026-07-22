(function(){
  'use strict';
  if (window.__AOIS_ADVISOR__) return;
  window.__AOIS_ADVISOR__ = true;

  var style=document.createElement('style');
  style.textContent=''
  +'.aois-agent-call{position:fixed;right:22px;bottom:22px;z-index:9998;border:1px solid rgba(215,178,93,.55);background:linear-gradient(135deg,#d7b25d,#f2db94);color:#07152f;border-radius:999px;padding:13px 18px;font:700 13px Jost,Arial,sans-serif;box-shadow:0 14px 42px rgba(0,0,0,.35);cursor:pointer;letter-spacing:.02em}'
  +'.aois-agent-call:before{content:"✦";margin-right:8px}'
  +'.aois-agent-panel{position:fixed;right:22px;bottom:82px;width:min(410px,calc(100vw - 28px));max-height:min(650px,calc(100vh - 110px));z-index:9999;background:linear-gradient(160deg,#0d2452,#061127);color:#f7f9ff;border:1px solid rgba(255,255,255,.14);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.5);display:none;overflow:hidden;font-family:Jost,Arial,sans-serif}'
  +'.aois-agent-panel.on{display:flex;flex-direction:column}'
  +'.aois-agent-head{padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;gap:12px;align-items:center}.aois-agent-head b{font-family:Georgia,serif;font-size:18px}.aois-agent-head small{display:block;color:#9caac4;margin-top:3px}.aois-agent-close{background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.13);border-radius:8px;padding:6px 10px;cursor:pointer}'
  +'.aois-agent-body{padding:16px;overflow:auto;min-height:240px}.aois-agent-msg{padding:11px 12px;border-radius:12px;margin:0 0 10px;line-height:1.5;font-size:13px;white-space:pre-wrap}.aois-agent-msg.ai{background:rgba(100,216,255,.08);border:1px solid rgba(100,216,255,.18)}.aois-agent-msg.user{background:rgba(215,178,93,.1);border:1px solid rgba(215,178,93,.2)}'
  +'.aois-agent-quick{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.aois-agent-quick button{background:rgba(255,255,255,.06);color:#d9e4f7;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:7px 10px;font-size:11px;cursor:pointer}'
  +'.aois-agent-form{padding:12px;border-top:1px solid rgba(255,255,255,.1);display:grid;grid-template-columns:1fr auto;gap:8px}.aois-agent-form textarea{resize:none;min-height:52px;background:#07152f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px}.aois-agent-form button{border:0;border-radius:10px;background:linear-gradient(135deg,#80e3ff,#5dcaf8);color:#08203b;font-weight:800;padding:0 14px;cursor:pointer}'
  +'@media(max-width:600px){.aois-agent-call{right:12px;bottom:12px}.aois-agent-panel{right:7px;bottom:70px;width:calc(100vw - 14px)}}';
  document.head.appendChild(style);

  var button=document.createElement('button');
  button.className='aois-agent-call';
  button.type='button';
  button.textContent='Call AOIS Advisor';

  var panel=document.createElement('section');
  panel.className='aois-agent-panel';
  panel.setAttribute('aria-label','AOIS Opportunity Advisor');
  panel.innerHTML='<div class="aois-agent-head"><div><b>AOIS Opportunity Advisor</b><small>Your personal contract intelligence agent</small></div><button class="aois-agent-close" type="button">Close</button></div><div class="aois-agent-body"><div class="aois-agent-msg ai">I am ready. Ask me to explain a match, review your Business DNA, identify a capability gap, or recommend your next action.</div><div class="aois-agent-quick"><button type="button">What should I do next?</button><button type="button">Explain my best match</button><button type="button">How can I improve my profile?</button></div></div><form class="aois-agent-form"><textarea aria-label="Ask AOIS Advisor" placeholder="Ask about your business or an opportunity..."></textarea><button type="submit">Send</button></form>';

  document.body.appendChild(button);
  document.body.appendChild(panel);

  var body=panel.querySelector('.aois-agent-body');
  var textarea=panel.querySelector('textarea');
  function readObject(keys){for(var i=0;i<keys.length;i++){try{var value=localStorage.getItem(keys[i]);if(value)return JSON.parse(value);}catch(e){}}return {};}
  function currentOpportunity(){try{return JSON.parse(localStorage.getItem('aois_selected_opportunity')||localStorage.getItem('selectedOpportunity')||'{}');}catch(e){return {};}}
  function add(text,type){var div=document.createElement('div');div.className='aois-agent-msg '+type;div.textContent=text;body.appendChild(div);body.scrollTop=body.scrollHeight;return div;}
  async function ask(text){text=String(text||'').trim();if(!text)return;add(text,'user');var waiting=add('AOIS is reviewing your context...','ai');textarea.value='';try{var res=await fetch('/api/aois-advisor',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,page:location.pathname,profile:readObject(['natcorp_profile','calgcc_profile']),opportunity:currentOpportunity()})});var data=await res.json();waiting.textContent=data.answer||data.error||'The advisor could not respond.';}catch(e){waiting.textContent='The AOIS Advisor is temporarily unavailable. Please try again.';}body.scrollTop=body.scrollHeight;}

  button.onclick=function(){panel.classList.toggle('on');if(panel.classList.contains('on'))textarea.focus();};
  panel.querySelector('.aois-agent-close').onclick=function(){panel.classList.remove('on');};
  panel.querySelector('.aois-agent-form').onsubmit=function(e){e.preventDefault();ask(textarea.value);};
  panel.querySelectorAll('.aois-agent-quick button').forEach(function(q){q.onclick=function(){ask(q.textContent);};});
})();
