'use strict';
// Opening linked layers, KaTeX labels of the static figures, and the active section in the contents bar.
(() => {
 // Opening a target inside a closed layer (e.g. a link to a definition).
 function revealHash(){const t=location.hash&&document.getElementById(location.hash.slice(1));if(t&&t.tagName==='DETAILS')t.open=true;}
 window.addEventListener('hashchange',revealHash);revealHash();

 const macros={'\\R':'\\mathbb{R}','\\Z':'\\mathbb{Z}','\\SL':'\\mathrm{SL}','\\SO':'\\mathrm{SO}','\\one':'1\\!\\!1'};
 const data=window.STATIC_FIGURE_LABELS||{};
 document.querySelectorAll('.fig-stage[data-fig]').forEach(stage=>{
  const fig=data[stage.dataset.fig];if(!fig)return;
  fig.labels.forEach(l=>{
   const span=document.createElement('span');
   span.className='fig-label '+(l.cls||'');span.style.left=l.x+'%';span.style.top=l.y+'%';
   try{katex.render(l.tex,span,{macros,throwOnError:true});}catch(e){span.textContent=l.tex;console.error(e);}
   stage.appendChild(span);
  });
 });

 const links=[...document.querySelectorAll('.reading-nav a')];
 const sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
 if('IntersectionObserver' in window&&sections.length){
  const seen=new Map();
  const io=new IntersectionObserver(entries=>{
   entries.forEach(e=>seen.set(e.target.id,e.isIntersecting));
   const current=sections.find(s=>seen.get(s.id));
   links.forEach(a=>a.classList.toggle('current',!!current&&a.getAttribute('href')==='#'+current.id));
  },{rootMargin:'-20% 0px -70% 0px'});
  sections.forEach(s=>io.observe(s));
 }
})();
