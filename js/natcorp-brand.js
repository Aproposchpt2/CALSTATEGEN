(function(){
  'use strict';
  var replacements=[
    [/California Government Contracts Center/g,'National Corporation Contract Exchange'],
    [/California Government Contracts/g,'State and Local Government Contracts'],
    [/California public agency solicitations/g,'State and local public agency solicitations'],
    [/California solicitations/g,'state and local solicitations'],
    [/California contracts/g,'state and local contracts'],
    [/California opportunity match/g,'state and local opportunity match'],
    [/California opportunities/g,'state and local opportunities'],
    [/CalStateGen/g,'NAT-CORP'],
    [/CalGovCC/g,'NAT-CORP'],
    [/CalGCC/g,'NAT-CORP']
  ];
  function replaceText(root){
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    var node;
    while((node=walker.nextNode())){
      if(!node.parentElement||/^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement.tagName)) continue;
      var value=node.nodeValue;
      replacements.forEach(function(pair){value=value.replace(pair[0],pair[1]);});
      if(value!==node.nodeValue) node.nodeValue=value;
    }
  }
  function applyBrand(){
    var title=document.title;
    replacements.forEach(function(pair){title=title.replace(pair[0],pair[1]);});
    document.title=title;
    replaceText(document.body);
    document.querySelectorAll('.mark,.brand .mark').forEach(function(el){
      if((el.textContent||'').trim()==='CA') el.textContent='NCX';
    });
    if(!document.querySelector('[data-ngcc-link]')){
      var host=document.querySelector('.nav-right,.topbar,.nav');
      if(host){
        var a=document.createElement('a');
        a.href='https://ngcc.aproposgroupllc.com';
        a.textContent='Federal Contractors →';
        a.setAttribute('data-ngcc-link','true');
        a.style.cssText='font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.68);text-decoration:none;margin-left:10px';
        host.appendChild(a);
      }
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyBrand); else applyBrand();
})();
