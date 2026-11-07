// Window controls remain usable without Google services.
const dock=document.querySelector('#window-dock'),main=document.querySelector('.window'),menu=document.querySelector('.menubar'),maximize=document.querySelector('#maximize-main');
let beforeMaximize;
const registered=new WeakSet(),windowOptions=new WeakMap();
export function bringToFront(win){for(const item of document.querySelectorAll('.window,.folder-window'))item.style.zIndex='1';win.style.zIndex='2';}
function folderMark(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 48 48');svg.setAttribute('aria-hidden','true');svg.classList.add('dock-folder-icon');svg.innerHTML='<path d="M4 12h17l5 5h18v25H4z" fill="#ddd" stroke="#111" stroke-width="2"/><path d="M4 19h40" stroke="#111"/>';return svg;}
function dockLabel(button,title,icon){button.replaceChildren();if(icon==='folder')button.append(folderMark());else button.append(document.createTextNode('▣ '));const label=document.createElement('span');label.textContent=title;button.append(label);button.title='Restore '+title;button.setAttribute('aria-label','Restore '+title);}
export function updateWindowTitle(win){const options=windowOptions.get(win);if(!options)return;const title=options.title();win.querySelector('.window-control')?.setAttribute('aria-label','Minimize '+title);const item=dock.querySelector(`[data-window="${win.id}"]`);if(item)dockLabel(item,title,options.icon);}
export function showWindow(win){dock.querySelector(`[data-window="${win.id}"]`)?.remove();if(!win.open)win[win.dataset.nonmodal==='true'?'show':'showModal']();bringToFront(win);constrain(win);}
export function registerWindow(win,options={}){
 if(registered.has(win))return;registered.add(win);const bar=win.querySelector('.dialog-title'),name=bar.textContent;
 const settings={title:options.title||(()=>bar.querySelector('#person-dialog-title')?.textContent||name),icon:options.icon};windowOptions.set(win,settings);
 const button=document.createElement('button');button.type='button';button.className='window-control';button.textContent='−';button.onclick=()=>minimize(win,settings.title(),settings.icon);bar.prepend(button);movable(win,bar);updateWindowTitle(win);
 if(win.dataset.nonmodal==='true')win.addEventListener('pointerdown',()=>bringToFront(win));
}

function constrain(win){
  if(win.hidden||(win instanceof HTMLDialogElement&&!win.open)||win.classList.contains('maximized'))return;
  const rect=win.getBoundingClientRect(),top=menu.getBoundingClientRect().bottom;
  if(win.style.position==='fixed'){
    win.style.left=`${Math.max(0,Math.min(rect.left,innerWidth-rect.width))}px`;
    win.style.top=`${Math.max(top,Math.min(rect.top,innerHeight-Math.min(rect.height,180)))}px`;
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
  if(win instanceof HTMLDialogElement)win.close();else win.hidden=true;
  const restore=document.createElement('button');restore.dataset.window=win.id;dockLabel(restore,title,icon);
  restore.onclick=()=>{if(win instanceof HTMLDialogElement)win[win.dataset.nonmodal==='true'?'show':'showModal']();else win.hidden=false;restore.remove();bringToFront(win);constrain(win);win.querySelector('.titlebar,.dialog-title')?.focus();};dock.append(restore);restore.focus();
}
main.id='records-window';movable(main,main.querySelector('.titlebar'));main.addEventListener('pointerdown',()=>bringToFront(main));
document.querySelector('#minimize-main').onclick=()=>minimize(main,'Brother Health Records - Main');
maximize.onclick=()=>{
  const isMaximized=main.classList.contains('maximized');
  if(isMaximized){main.classList.remove('maximized');main.style.cssText=beforeMaximize||'';constrain(main);}
  else{beforeMaximize=main.style.cssText;main.style.cssText='';main.classList.add('maximized');}
  maximize.setAttribute('aria-pressed',String(!isMaximized));maximize.setAttribute('aria-label',isMaximized?'Maximize window':'Restore window');maximize.title=isMaximized?'Maximize window':'Restore window';maximize.textContent=isMaximized?'□':'▣';
};
for(const dialog of document.querySelectorAll('dialog'))if(dialog.dataset.simple!=='true')registerWindow(dialog);
new ResizeObserver(layout).observe(menu);window.addEventListener('resize',layout);layout();
