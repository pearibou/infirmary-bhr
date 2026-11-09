// Desktop-only selection. App launchers are deliberately not registered.
const registry=new WeakMap(),chosen=new Map(),desktop=document.querySelector('.desktop');
let gesture,box,dragging=false;
const key=target=>target.fileId?'file:'+target.fileId:'sticky:'+target.desktopNoteId;
function items(){return [...document.querySelectorAll('[data-desktop-selectable]')].filter(node=>node.isConnected&&node.getClientRects().length);}
function paint(){for(const node of items())node.classList.toggle('desktop-selected',chosen.has(key(registry.get(node))));}
export function registerDesktopItem(node,target){registry.set(node,target);node.dataset.desktopSelectable='true';queueMicrotask(paint);}
export function clearDesktopSelection(){chosen.clear();paint();cancelGesture();}
function request(){if(chosen.size)document.dispatchEvent(new CustomEvent('desktop-trash-request',{detail:[...chosen.values()]}));}
function cancelGesture(){gesture=null;box?.remove();box=null;}
function empty(event){return event.target===desktop||event.target.id==='desktop-icons';}
document.addEventListener('pointerdown',event=>{
 if(document.querySelector('dialog:modal'))return;
 const selectable=event.target.closest('[data-desktop-selectable]');
 if(!empty(event)&&!event.target.closest('#desktop-trash')&&(!selectable||!chosen.has(key(registry.get(selectable))))){chosen.clear();paint();}
 if(event.button!==0||document.body.classList.contains('drive-locked')||document.querySelector('dialog:modal')||!empty(event))return;
 event.preventDefault();desktop.focus({preventScroll:true});gesture={x:event.clientX,y:event.clientY,add:event.ctrlKey||event.metaKey||event.shiftKey,prior:new Map(chosen)};
 if(!gesture.add){chosen.clear();paint();}desktop.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
 if(!gesture)return;const {x,y}=gesture;if(!box&&Math.hypot(event.clientX-x,event.clientY-y)<4)return;
 event.preventDefault();if(!box){box=document.createElement('div');box.id='desktop-selection-box';box.setAttribute('aria-hidden','true');document.body.append(box);}
 const left=Math.min(x,event.clientX),top=Math.min(y,event.clientY),right=Math.max(x,event.clientX),bottom=Math.max(y,event.clientY);
 Object.assign(box.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});chosen.clear();if(gesture.add)for(const [k,v] of gesture.prior)chosen.set(k,v);
 for(const node of items()){const rect=node.getBoundingClientRect(),cx=(rect.left+rect.right)/2,cy=(rect.top+rect.bottom)/2;
  // Do not select desktop icons concealed behind another window.
  const hit=document.elementFromPoint(cx,cy);if(hit&&!node.contains(hit)&&hit!==node)continue;
  if(rect.right>left&&rect.left<right&&rect.bottom>top&&rect.top<bottom){const target=registry.get(node);chosen.set(key(target),target);}}
 paint();
});
document.addEventListener('pointerup',cancelGesture);document.addEventListener('pointercancel',cancelGesture);
document.addEventListener('keydown',event=>{
 if(document.body.classList.contains('drive-locked')||document.querySelector('dialog:modal')||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if(event.key==='Escape'){clearDesktopSelection();return;}
 if(event.key==='Delete'&&chosen.size&&!event.target.closest('.window,dialog,.menubar,#window-dock')){event.preventDefault();event.stopImmediatePropagation();request();}
},true);
document.querySelector('#desktop-trash').addEventListener('click',event=>{if(!chosen.size)return;event.preventDefault();event.stopImmediatePropagation();request();},true);
document.addEventListener('dragstart',event=>{const node=event.target.closest('[data-desktop-selectable]');if(!node||chosen.size<2||!chosen.has(key(registry.get(node))))return;dragging=true;event.stopImmediatePropagation();event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-bhr-selection','selection');document.body.classList.add('dragging-entry');},true);
const trash=document.querySelector('#desktop-trash');trash.addEventListener('dragover',event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect='move';trash.classList.add('drop-ready');}});
trash.addEventListener('drop',event=>{if(!dragging)return;event.preventDefault();event.stopImmediatePropagation();dragging=false;trash.classList.remove('drop-ready');document.body.classList.remove('dragging-entry');request();},true);
document.addEventListener('dragend',()=>{dragging=false;trash.classList.remove('drop-ready');document.body.classList.remove('dragging-entry');});
