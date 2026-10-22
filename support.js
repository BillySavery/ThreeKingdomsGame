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
document.querySelectorAll('[data-support-link]').forEach(el=>{
  el.innerHTML='<a class="kofilink" href="'+URL+'" target="_blank" rel="noopener">Support the site on Ko-fi</a>';
});
})();
