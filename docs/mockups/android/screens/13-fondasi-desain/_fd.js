/* Modul 13: isi label hex dari token yang sedang aktif (terang/malam) + hitung kontras. */
(function(){
  function rgb(v){
    v=(v||'').trim();var m;
    if((m=v.match(/^#([0-9a-f]{6})$/i)))return [parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];
    if((m=v.match(/^#([0-9a-f]{3})$/i)))return m[1].split('').map(function(c){return parseInt(c+c,16)});
    if((m=v.match(/rgba?\(([^)]+)\)/)))return m[1].split(',').slice(0,3).map(function(x){return parseFloat(x)});
    return null;
  }
  function lum(c){var a=c.map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]}
  function ratio(a,b){var x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
  function run(){
    var cs=getComputedStyle(document.documentElement);
    document.querySelectorAll('[data-v]').forEach(function(el){
      var raw=cs.getPropertyValue(el.dataset.v).trim();
      el.textContent=/^#/.test(raw)?raw.toUpperCase():raw.replace(/\s+/g,' ');
    });
    document.querySelectorAll('[data-kontras]').forEach(function(el){
      var p=el.dataset.kontras.split('|');
      function val(t){t=t.trim();return t.charAt(0)==='#'?t:cs.getPropertyValue(t).trim()}
      var a=rgb(val(p[0])),b=rgb(val(p[1]));
      if(!a||!b){el.textContent='?';return}
      var r=ratio(a,b);el.textContent=r.toFixed(1).replace('.',',')+' : 1';
      var min=parseFloat(el.dataset.min||'4.5');
      el.dataset.lulus=r>=min?'ya':'tidak';var ps=el.parentNode.querySelector('.fd-pass');if(ps){var ok=r>=min;ps.textContent=ok?'✓ lulus':'✕ tidak';ps.style.color=ok?'var(--ok)':'var(--bad)';ps.style.fontWeight='700'}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
