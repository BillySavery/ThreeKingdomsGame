/* Ko-fi support block. Change KOFI to your Ko-fi page name and every page updates. */
(()=>{
const KOFI='threekingdomsgame';
const URL='https://ko-fi.com/'+KOFI;
const css=`
.kofi{margin-top:18px;padding-top:16px;border-top:1px solid var(--line,#4a3a2a);display:grid;gap:10px;justify-items:center;text-align:center}
.kofi p{margin:0;font-size:13px;line-height:1.5;color:var(--mute,#a8987f);max-width:40ch}
.kofi a{display:inline-flex;align-items:center;gap:8px;font-family:var(--ui,system-ui,sans-serif);font-weight:600;font-size:13px;letter-spacing:.06em;text-transform:uppercase;padding:9px 14px;color:var(--gold,#d9a441);border:1px solid var(--gold,#d9a441);text-decoration:none}
.kofi a:hover{background:rgba(217,164,65,.12)}
.kofi a:focus-visible{outline:2px solid var(--gold,#d9a441);outline-offset:2px}
.kofi svg{width:16px;height:16px;flex:none}
.kofilink{color:var(--gold,#d9a441);text-decoration:none}
.kofilink:hover{text-decoration:underline}`;
const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);
const cup='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 2v3M12 2v3"/></svg>';
document.querySelectorAll('[data-support]').forEach(el=>{
  el.className='kofi';
  el.innerHTML='<p>Three Kingdoms Daily is a one person passion project. If you enjoy it, a cup of wine for Liu Bei keeps it running.</p><a href="'+URL+'" target="_blank" rel="noopener">'+cup+'Support on Ko-fi</a>';
});
/* Ko-fi pop up: appears a moment after a game is finished, not on a reload of a finished game.
   Not before a player's third finished game, at most once every 3 days, and not for 30 days after they tap through to Ko-fi. */
const store={get(k,d){try{const v=localStorage.getItem('kofi_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('kofi_'+k,JSON.stringify(v))}catch(e){}}};
const DAY=864e5,EVERY=3*DAY,AFTER_CLICK=30*DAY,MIN_FINISHED=3;
const css2=`
.kpop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(10,8,6,.72);opacity:0;transition:opacity .25s}
.kpop.on{opacity:1}
.kpop .box{position:relative;width:100%;max-width:380px;background:var(--panel,#1f1813);border:1px solid var(--gold,#d9a441);padding:28px 24px 22px;text-align:center;color:var(--paper,#efe4cf);box-shadow:0 18px 50px rgba(0,0,0,.5);transform:translateY(10px);transition:transform .25s}
.kpop.on .box{transform:none}
.kpop .seal{width:52px;height:52px;margin:0 auto 12px;display:grid;place-items:center;border:1px solid var(--gold,#d9a441);color:var(--gold,#d9a441)}
.kpop .seal svg{width:26px;height:26px}
.kpop .seal span{font-family:'Zen Antique',Georgia,serif;font-size:28px;line-height:1}
.kpop button.go{cursor:pointer}
.kpop h2{margin:0 0 8px;font-family:'Zen Antique',Georgia,serif;font-weight:400;font-size:24px;color:var(--paper,#efe4cf)}
.kpop p{margin:0 0 18px;font-size:14px;line-height:1.55;color:var(--mute,#a8987f)}
.kpop .go{display:flex;justify-content:center;align-items:center;gap:8px;width:100%;padding:12px 16px;background:var(--gold,#d9a441);color:var(--ink,#14100d);font-family:var(--ui,system-ui,sans-serif);font-weight:700;font-size:14px;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;border:0}
.kpop .go svg{width:18px;height:18px}
.kpop .later{margin-top:10px;background:none;border:0;color:var(--mute,#a8987f);font:600 13px var(--ui,system-ui,sans-serif);letter-spacing:.06em;text-transform:uppercase;cursor:pointer;padding:8px}
.kpop .x{position:absolute;top:6px;right:8px;background:none;border:0;color:var(--mute,#a8987f);font-size:24px;line-height:1;cursor:pointer;padding:6px}
.kpop button:focus-visible,.kpop a:focus-visible{outline:2px solid var(--gold,#d9a441);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.kpop,.kpop .box{transition:none}}`;
const s2=document.createElement('style');s2.textContent=css2;document.head.appendChild(s2);
// Shared pop up. opts: {seal, title, body, go:{text,href,icon}, later, onGo, key}
function openPop(o){
  if(document.querySelector('.kpop'))return false;
  const prev=document.activeElement;
  const w=document.createElement('div');w.className='kpop';
  const go=o.go.href?'<a class="go" href="'+o.go.href+'" target="_blank" rel="noopener">'+(o.go.icon||'')+o.go.text+'</a>':'<button class="go">'+o.go.text+'</button>';
  w.innerHTML='<div class="box" role="dialog" aria-modal="true" aria-labelledby="kpopT"><button class="x" aria-label="Close">&times;</button><div class="seal">'+o.seal+'</div><h2 id="kpopT"></h2><p></p>'+go+(o.later?'<button class="later">'+o.later+'</button>':'')+'</div>';
  w.querySelector('h2').textContent=o.title;w.querySelector('p').textContent=o.body;
  document.body.appendChild(w);requestAnimationFrame(()=>w.classList.add('on'));
  const close=()=>{w.classList.remove('on');setTimeout(()=>w.remove(),250);document.removeEventListener('keydown',key);if(prev&&prev.focus)prev.focus()};
  const key=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const f=[...w.querySelectorAll('a,button')],i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}}};
  document.addEventListener('keydown',key);
  w.querySelector('.x').onclick=close;if(o.later)w.querySelector('.later').onclick=close;
  w.addEventListener('click',e=>{if(e.target===w)close()});
  w.querySelector('.go').onclick=()=>{if(o.onGo)o.onGo();close()};
  w.querySelector('.go').focus();
  return true;
}
window.tkPopup=openPop;
function showPop(){
  if(openPop({seal:cup,title:'Enjoying the campaign?',body:'Three Kingdoms Daily is made by one person in their spare time. If it has become part of your day, a cup of wine for Liu Bei helps keep new puzzles coming.',go:{text:'Support on Ko-fi',href:URL,icon:cup},later:'Maybe later',onGo:()=>store.set('clicked',Date.now())}))store.set('shown',Date.now());
}
function finished(){
  const n=store.get('finished',0)+1;store.set('finished',n);
  const now=Date.now();
  if(n<MIN_FINISHED||now-store.get('shown',0)<EVERY||now-store.get('clicked',0)<AFTER_CLICK)return;
  setTimeout(showPop,1800);
}
// Watch the end of game support block: when it goes from hidden to visible, the game was just finished
const blocks=[...document.querySelectorAll('[data-support]')];
if(blocks.length){
  const vis=()=>blocks.some(b=>b.getClientRects().length>0);
  let was=vis();
  const mo=new MutationObserver(()=>{const v=vis();if(v&&!was)finished();was=v});
  mo.observe(document.body,{attributes:true,attributeFilter:['hidden','class','style'],subtree:true,childList:true});
}
if(location.hash==='#kofi-test')setTimeout(showPop,400);
document.querySelectorAll('[data-support-link]').forEach(el=>{
  el.innerHTML='<a class="kofilink" href="'+URL+'" target="_blank" rel="noopener">Support the site on Ko-fi</a>';
});

/* Report a problem: added to the footer on every page, linking to the subreddit */
const REDDIT='https://www.reddit.com/r/ThreeKingdomsGames/';
(()=>{
  const a='<a class="kofilink" href="'+REDDIT+'" target="_blank" rel="noopener">Report a problem</a>';
  let f=document.querySelector('footer');
  if(f){const sp=document.createElement('span');sp.innerHTML=a;const k=f.querySelector('[data-support-link]');k?k.after(sp):f.appendChild(sp);return}
  const host=document.querySelector('.wrap')||document.body;
  f=document.createElement('footer');
  f.style.cssText='border-top:1px solid var(--line,#4a3a2a);margin-top:24px;padding-top:16px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--mute,#a8987f)';
  f.innerHTML='<span>'+a+'</span>';host.appendChild(f);
})();
})();
