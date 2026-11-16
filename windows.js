// Window controls remain usable without Google services.
const dock=document.querySelector('#window-dock'),main=document.querySelector('.window'),menu=document.querySelector('.menubar'),maximize=document.querySelector('#maximize-main');
let beforeMaximize;
const registered=new WeakSet(),windowOptions=new WeakMap(),minimizing=new WeakSet();
const floatingResize=new ResizeObserver(entries=>{for(const {target} of entries)constrain(target);});
export function bringToFront(win){for(const item of document.querySelectorAll('.window,.folder-window,dialog[data-nonmodal="true"]'))item.style.zIndex='1';win.style.zIndex='2';}
function folderMark(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 48 48');svg.setAttribute('aria-hidden','true');svg.classList.add('dock-folder-icon');svg.innerHTML='<path d="M4 12h17l5 5h18v25H4z" fill="#ddd" stroke="#111" stroke-width="2"/><path d="M4 19h40" stroke="#111"/>';return svg;}
function dockLabel(button,title,icon){button.replaceChildren();if(icon==='folder')button.append(folderMark());else button.append(document.createTextNode('▣ '));const label=document.createElement('span');label.textContent=title;button.append(label);button.title='Restore '+title;button.setAttribute('aria-label','Restore '+title);}
export function updateWindowTitle(win){const options=windowOptions.get(win);if(!options)return;const title=options.title();win.querySelector('.window-control')?.setAttribute('aria-label','Minimize '+title);const item=dock.querySelector(`[data-window="${win.id}"]`);if(item)dockLabel(item,title,options.icon);}
export function showWindow(win){dock.querySelector(`[data-window="${win.id}"]`)?.remove();if(!win.open){if(win.dataset.nonmodal==='true'){win.show();if(!win.dataset.windowPlaced){const rect=win.getBoundingClientRect(),offset=(document.querySelectorAll('dialog[data-nonmodal="true"][open]').length-1)%5*24;win.style.left=Math.max(12,(innerWidth-rect.width)/2+offset)+'px';win.style.top=menu.getBoundingClientRect().bottom+16+offset+'px';win.dataset.windowPlaced='true';}}else win.showModal();}bringToFront(win);constrain(win);}
export function registerWindow(win,options={}){
 if(registered.has(win))return;registered.add(win);const bar=win.querySelector('.dialog-title'),name=bar.textContent;
 const settings={title:options.title||(()=>bar.querySelector('#person-dialog-title,[data-window-title]')?.textContent||name),icon:options.icon};windowOptions.set(win,settings);
 const button=document.createElement('button');button.type='button';button.className='window-control';button.textContent='−';button.onclick=()=>minimize(win,settings.title(),settings.icon);bar.prepend(button);movable(win,bar);updateWindowTitle(win);
 if(win.dataset.nonmodal==='true'){floatingResize.observe(win);win.setAttribute('aria-modal','false');win.addEventListener('pointerdown',()=>bringToFront(win));win.addEventListener('focusin',()=>bringToFront(win));win.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.target.closest('input,textarea,select,[contenteditable="true"]')){const cancel=new Event('cancel',{cancelable:true});if(win.dispatchEvent(cancel)){event.preventDefault();win.close();}}});}
}

function constrain(win){
  if(win.hidden||(win instanceof HTMLDialogElement&&!win.open)||win.classList.contains('maximized'))return;
  const floating=win.dataset.nonmodal==='true',top=menu.getBoundingClientRect().bottom;
  const rect=win.getBoundingClientRect();
  if(win.style.position==='fixed'||floating){
    win.style.left=`${Math.max(0,Math.min(rect.left,innerWidth-rect.width))}px`;
    win.style.top=`${Math.max(top,Math.min(rect.top,innerHeight-(floating?rect.height+12:Math.min(rect.height,180))))}px`;
  }
  if(win===main){const current=win.getBoundingClientRect();win.style.setProperty('--window-room-height',`${Math.max(180,innerHeight-current.top-8)}px`);win.style.setProperty('--window-room-width',`${Math.max(300,innerWidth-current.left-8)}px`);}
}
function layout(){
  const top=menu.getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--desktop-top',`${top}px`);
  document.documentElement.style.setProperty('--desktop-rows',Math.max(1,Math.floor((innerHeight-top-128)/96)));
  constrain(main);for(const dialog of document.querySelectorAll('dialog'))constrain(dialog);
}
function movable(win,bar){
  bar.tabIndex=0;bar.title='Drag to move; arrow keys move this window';
  function move(left,top){const rect=win.getBoundingClientRect(),menuRect=menu.getBoundingClientRect();Object.assign(win.style,{position:'fixed',margin:'0',width:`${rect.width}px`,left:`${Math.max(0,Math.min(left,innerWidth-rect.width))}px`,top:`${Math.max(menuRect.bottom,Math.min(top,innerHeight-180))}px`});constrain(win);}
  bar.addEventListener('pointerdown',event=>{
    if(win.classList.contains('maximized')||event.target.closest('button')||event.button!==0)return;
    const rect=win.getBoundingClientRect(),x=event.clientX,y=event.clientY;bar.setPointerCapture(event.pointerId);
    const drag=e=>move(rect.left+e.clientX-x,rect.top+e.clientY-y);
    const stop=()=>{bar.removeEventListener('pointermove',drag);bar.removeEventListener('pointerup',stop);bar.removeEventListener('pointercancel',stop);};
    bar.addEventListener('pointermove',drag);bar.addEventListener('pointerup',stop);bar.addEventListener('pointercancel',stop);event.preventDefault();
  });
  bar.addEventListener('keydown',event=>{if(win.classList.contains('maximized')||event.target!==bar||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const rect=win.getBoundingClientRect();move(rect.left+(event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0),rect.top+(event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0));});
}
function minimize(win,title,icon){
  if(dock.querySelector(`[data-window="${win.id}"]`))return;
  if(win instanceof HTMLDialogElement){if(win.open){minimizing.add(win);win.dispatchEvent(new Event('window-minimize'));}win.close();}else win.hidden=true;
  const restore=document.createElement('button');restore.dataset.window=win.id;dockLabel(restore,title,icon);
  restore.onclick=()=>{if(win instanceof HTMLDialogElement)showWindow(win);else{win.hidden=false;bringToFront(win);constrain(win);}restore.remove();(win.querySelector('[data-restore-focus][contenteditable="true"]')||win.querySelector('.titlebar,.dialog-title'))?.focus();};dock.append(restore);restore.focus();
}
export function openMainWindow(){main.hidden=false;dock.querySelector('[data-window="records-window"]')?.remove();bringToFront(main);constrain(main);main.querySelector('.titlebar').focus();}
export function closeMainWindow(){main.hidden=true;dock.querySelector('[data-window="records-window"]')?.remove();document.querySelector('#bhr-icon')?.focus();}
main.id='records-window';movable(main,main.querySelector('.titlebar'));main.addEventListener('pointerdown',()=>bringToFront(main));main.addEventListener('focusin',()=>bringToFront(main));
document.querySelector('#close-main').onclick=closeMainWindow;
document.querySelector('#minimize-main').onclick=()=>minimize(main,'Brother Health Records - Main');
maximize.onclick=()=>{
  const isMaximized=main.classList.contains('maximized');
  if(isMaximized){main.classList.remove('maximized');main.style.cssText=beforeMaximize||'';constrain(main);}
  else{beforeMaximize=main.style.cssText;main.style.cssText='';main.classList.add('maximized');}
  maximize.setAttribute('aria-pressed',String(!isMaximized));maximize.setAttribute('aria-label',isMaximized?'Maximize window':'Restore window');maximize.title=isMaximized?'Maximize window':'Restore window';maximize.textContent=isMaximized?'□':'▣';
};
for(const dialog of document.querySelectorAll('dialog'))if(dialog.dataset.simple!=='true')registerWindow(dialog);
for(const dialog of document.querySelectorAll('dialog[data-window-owner]'))dialog.addEventListener('close',()=>{
 if(minimizing.has(dialog)){minimizing.delete(dialog);return;}
 const owner=document.getElementById(dialog.dataset.windowOwner);
 if(owner?.open&&!document.querySelector('dialog:modal')){bringToFront(owner);constrain(owner);owner.querySelector('.dialog-title')?.focus({preventScroll:true});}
});

new ResizeObserver(layout).observe(menu);window.addEventListener('resize',layout);layout();
