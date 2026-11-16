import {loadCatalog} from './history-model.js?v=fy2027';
import {prepareTabular,ancestry,lookup,noteLabels} from './icd-lookup-model.js?v=1';
import {showWindow} from './windows.js?v=0.31.1';
const $=s=>document.querySelector(s),win=$('#icd-lookup-dialog'),key='infirmary.icdLookup.v1';
let ready=false,model,pending,selected=null,tab='search',recent=[],timer,generation=0,floating;
let prefs={side:'float',width:360,bookmarks:[]};
try{const saved=JSON.parse(localStorage.getItem(key));if(saved){prefs.side=['left','right','float'].includes(saved.side)?saved.side:'float';prefs.width=Math.max(280,Math.min(560,Number(saved.width)||360));prefs.bookmarks=Array.isArray(saved.bookmarks)?saved.bookmarks.filter(c=>typeof c==='string'&&c.length<12).slice(0,200):[];}}catch{}
function save(){try{localStorage.setItem(key,JSON.stringify(prefs));}catch{}}
function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
function status(text){$('#icd-status').textContent=text;}
function dock(){
 const snapped=win.open&&prefs.side!=='float'&&innerWidth>=960;
 win.dataset.snap=snapped?prefs.side:'float';
 for(const side of ['left','right'])document.documentElement.style.setProperty('--reference-'+side,snapped&&prefs.side===side?prefs.width+'px':'0px');
 document.body.classList.toggle('icd-reference-reserved',snapped);
 if(snapped){if(!floating)floating={left:win.style.left,top:win.style.top,width:win.style.width,height:win.style.height};Object.assign(win.style,{left:prefs.side==='left'?'0px':innerWidth-prefs.width+'px',top:$('.menubar').getBoundingClientRect().bottom+'px',width:prefs.width+'px',height:innerHeight-$('.menubar').getBoundingClientRect().bottom+'px'});}
 else if(floating){Object.assign(win.style,floating);floating=null;}
 $('#icd-resizer').hidden=!snapped;$('#icd-resizer').setAttribute('aria-valuenow',String(prefs.width));
 for(const b of win.querySelectorAll('[data-side]'))b.setAttribute('aria-pressed',String(b.dataset.side===prefs.side));
 window.dispatchEvent(new Event('workspace-bounds-change'));
}
async function open(){if(!ready)return;showWindow(win);dock();$('#icd-query').focus();if(model){render();return;}const token=generation;status('Loading public FY2027 reference…');try{if(!pending)pending=Promise.all([loadCatalog(),fetch('./data/icd10cm-tabular-2027.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('The public tabular reference could not be loaded.');return r.json();})]).then(([catalog,data])=>prepareTabular(data,catalog)).catch(e=>{pending=null;throw e;});const loaded=await pending;if(token!==generation)return;model=loaded;$('#icd-edition').textContent=model.edition+' · Effective 10/01/2026–09/30/2027';status('Public reference only. Reporting status does not determine payment.');render();}catch(e){if(token===generation){status(e.message+' Use Retry to try again.');$('#icd-retry').hidden=false;}}}
function choose(id){selected=id;$('#icd-layout').classList.add('show-detail');renderDetail();}
function row(node){const b=button((node.code?node.code+' — ':'')+node.title,()=>choose(node.id));b.className='icd-result';const small=document.createElement('small');small.textContent=node.code?(node.reportable?'Reportable':'Choose a more specific code'):'Browse category';if(node.matchKind==='spelling')small.textContent+=' · Spelling/prefix match';if(node.matchKind==='related')small.textContent+=' · Related match';b.append(small);return b;}
function render(){if(!model)return;for(const b of win.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===tab));$('#icd-search-form').hidden=tab!=='search';const list=$('#icd-list');list.replaceChildren();
 if(tab==='search'){const query=$('#icd-query').value.trim();const results=lookup(model,query);for(const node of results)list.append(row(node));if(!results.length)list.textContent=query.length<2?'Enter a code, description, abbreviation, or common term.':'No matches. Try fewer terms or browse the tabular list.';}
 if(tab==='browse')for(const node of model.children.get(null)||[])list.append(row(node));
 if(tab==='saved'){const heading=document.createElement('h3');heading.textContent='Bookmarked codes';list.append(heading);for(const code of prefs.bookmarks){const node=model.nodes.get(code);if(node)list.append(row(node));}const h=document.createElement('h3');h.textContent='Recent searches (this session)';list.append(h);for(const query of recent)list.append(button(query,()=>{$('#icd-query').value=query;tab='search';render();}));list.append(button('Clear recent searches',()=>{recent=[];render();}));}
 renderDetail();}
async function copy(text){try{await navigator.clipboard.writeText(text);status('Copied to clipboard.');}catch{status('Clipboard unavailable. Select the code or description and copy it manually.');}}
function renderDetail(){const detail=$('#icd-detail');detail.replaceChildren();const node=model?.nodes.get(selected);if(!node){detail.textContent='Select a result or category to inspect its codes and official notes.';return;}
 detail.append(button('← Back to list',()=>$('#icd-layout').classList.remove('show-detail')));
 const trail=document.createElement('nav');trail.setAttribute('aria-label','Tabular path');for(const item of ancestry(model,node.id)){trail.append(button(item.code||item.title,()=>choose(item.id)));}detail.append(trail);
 const heading=document.createElement('h2');heading.textContent=(node.code?node.code+' — ':'')+node.title;detail.append(heading);
 if(node.code){const p=document.createElement('p');p.className='icd-reportable';p.textContent=node.reportable?'Reportable':'Choose a more specific code';detail.append(p);const actions=document.createElement('div');actions.className='icd-actions';actions.append(button('Copy code',()=>copy(node.code)),button('Copy description',()=>copy(node.title)),button('Copy both',()=>copy(node.code+' — '+node.title)),button(prefs.bookmarks.includes(node.code)?'★ Remove bookmark':'☆ Bookmark',()=>{if(prefs.bookmarks.includes(node.code))prefs.bookmarks=prefs.bookmarks.filter(c=>c!==node.code);else if(prefs.bookmarks.length<200)prefs.bookmarks.push(node.code);save();render();}));detail.append(actions);}
 const children=model.children.get(node.id)||[];if(children.length){const h=document.createElement('h3');h.textContent='More specific entries';detail.append(h);for(const child of children)detail.append(row(child));}
 for(const source of ancestry(model,node.id).reverse()){if(!source.notes.length)continue;const section=document.createElement('section');section.className='icd-notes';const h=document.createElement('h3');h.textContent=source.id===node.id?'Official notes':'Inherited notes from '+(source.code||source.title);section.append(h);for(const [kind,text] of source.notes){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=(noteLabels[kind]||kind)+': ';p.append(strong,document.createTextNode(text));section.append(p);}detail.append(section);}
 const source=document.createElement('a');source.href=model.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Source: CDC/NCHS FY2027 tabular list';detail.append(source);
}
export function icdLookupSession(value){ready=value;if(!value){generation++;clearTimeout(timer);recent=[];selected=null;$('#icd-query').value='';$('#icd-list').replaceChildren();$('#icd-detail').replaceChildren();if(win.open)win.close();$('#window-dock [data-window="icd-lookup-dialog"]')?.remove();dock();}}
const icon=$('#icd-lookup-icon');icon.addEventListener('dblclick',open);icon.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();open();}});
$('#icd-retry').onclick=()=>{$('#icd-retry').hidden=true;open();};
$('#icd-search-form').onsubmit=e=>{e.preventDefault();const query=$('#icd-query').value.trim();if(query.length>=2){recent=[query,...recent.filter(q=>q!==query)].slice(0,12);}render();};
$('#icd-query').oninput=()=>{clearTimeout(timer);timer=setTimeout(render,180);};
for(const b of win.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;$('#icd-layout').classList.remove('show-detail');render();};
for(const b of win.querySelectorAll('[data-side]'))b.onclick=()=>{prefs.side=b.dataset.side;save();dock();};
win.addEventListener('close',dock);win.addEventListener('window-show',dock);window.addEventListener('resize',dock);
const handle=$('#icd-resizer');handle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();prefs.width=Math.max(280,Math.min(560,prefs.width+(e.key==='ArrowRight'?1:-1)*(prefs.side==='left'?1:-1)*10));save();dock();});
handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const x=e.clientX,width=prefs.width;handle.setPointerCapture(e.pointerId);const move=event=>{prefs.width=Math.max(280,Math.min(560,width+(event.clientX-x)*(prefs.side==='left'?1:-1))); dock();};const stop=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',stop);handle.removeEventListener('pointercancel',stop);save();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);});
