'use strict';
(() => {
 const preview=document.getElementById('reference-preview');
 if(!preview)return;
 let current=null,hideTimer=null;
 function hide(){preview.hidden=true;current=null;clearTimeout(hideTimer);}
 function place(){
  if(!current||preview.hidden)return;
  const r=current.getBoundingClientRect();
  const width=preview.offsetWidth,height=preview.offsetHeight;
  const left=Math.max(12,Math.min(r.left,innerWidth-width-12));
  let top=r.bottom+9;if(top+height>innerHeight-12)top=r.top-height-9;
  preview.style.left=left+'px';preview.style.top=Math.max(12,top)+'px';
 }
 function show(link){
  clearTimeout(hideTimer);current=link;preview.innerHTML=link.dataset.preview;preview.hidden=false;place();
 }
 document.querySelectorAll('a.citation').forEach(link=>{
  // The native title is retained in the HTML as a no-JavaScript fallback.
  link.removeAttribute('title');link.setAttribute('aria-describedby','reference-preview');
  link.addEventListener('mouseenter',()=>show(link));
  link.addEventListener('mouseleave',()=>{hideTimer=setTimeout(()=>{if(document.activeElement!==link)hide();},160);});
  link.addEventListener('focus',()=>show(link));
  link.addEventListener('blur',hide);
 });
 preview.addEventListener('mouseenter',()=>clearTimeout(hideTimer));
 preview.addEventListener('mouseleave',()=>{if(document.activeElement!==current)hide();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
 document.addEventListener('scroll',()=>{
  if(current&&document.activeElement===current){
   const rect=current.getBoundingClientRect();
   if(rect.bottom<0||rect.top>innerHeight)hide();else place();
  }else hide();
 },{capture:true,passive:true});
 window.addEventListener('resize',hide);
})();
