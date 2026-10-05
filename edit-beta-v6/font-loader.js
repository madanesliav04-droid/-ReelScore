'use strict';
(function(){
  const loaded=new Set();
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
    document.head.appendChild(link);
    loaded.add(name);
  }
  function loadPresetFont(select){
    try{
      const key=select?.value;
      const font=window.SUBTITLE_PRESETS?.[key]?.font || (typeof SUBTITLE_PRESETS!=='undefined' ? SUBTITLE_PRESETS[key]?.font : null);
      if(font)loadFont(font);
    }catch{}
  }
  window.__editplusLoadFont=loadFont;
  document.addEventListener('change',e=>{
    if(e.target?.id==='captionFont'||e.target?.id==='brandFont')loadFont(e.target.value);
    if(e.target?.id==='subtitlePreset'||e.target?.id==='editorSubtitlePreset')loadPresetFont(e.target);
  });
  // Only load the currently-used caption font after the editor is actually opened.
  document.addEventListener('click',e=>{
    if(e.target?.id==='generatePreviewBtn'){
      const s=document.getElementById('subtitlePreset');
      loadPresetFont(s);
    }
  });
})();
