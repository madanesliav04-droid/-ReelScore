'use strict';
(function(){
  const loaded=new Set(['Inter']);
  const map={
    'Inter':'Inter:wght@400;500;600;700;800;900',
    'Manrope':'Manrope:wght@400;500;600;700;800',
    'DM Sans':'DM+Sans:wght@400;500;600;700',
    'Montserrat':'Montserrat:wght@500;600;700;800',
    'Archivo':'Archivo:wght@400;600;700;800',
    'League Spartan':'League+Spartan:wght@500;600;700;800',
    'Anton':'Anton',
    'Bebas Neue':'Bebas+Neue',
    'Instrument Serif':'Instrument+Serif:ital@0;1',
    'Playfair Display':'Playfair+Display:wght@600;700'
  };
  function loadFont(name){
    if(!name||loaded.has(name))return;
    const family=map[name];if(!family)return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=`https://fonts.googleapis.com/css2?family=${family}&display=swap`;
    document.head.appendChild(link);loaded.add(name);
  }
  window.__editplusLoadFont=loadFont;
  document.addEventListener('change',e=>{
    if(e.target?.id==='captionFont'||e.target?.id==='brandFont')loadFont(e.target.value);
  });
})();
