// Window controls remain usable without Google services.
const dock=document.querySelector('#window-dock'),main=document.querySelector('.window'),menu=document.querySelector('.menubar'),maximize=document.querySelector('#maximize-main');
let beforeMaximize;
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
  document.documentElement.style.setProperty('--desktop-rows',Math.max(1,Math.floor((innerHeight-top-80)/96)));
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
function minimize(win,title){
  if(dock.querySelector(`[data-window="${win.id}"]`))return;
  if(win instanceof HTMLDialogElement)win.close();else win.hidden=true;
  const restore=document.createElement('button');restore.textContent=`▣ ${title}`;restore.dataset.window=win.id;restore.title='Restore '+title;
  restore.onclick=()=>{if(win instanceof HTMLDialogElement)win.showModal();else win.hidden=false;restore.remove();constrain(win);win.querySelector('.titlebar,.dialog-title')?.focus();};dock.append(restore);restore.focus();
}
main.id='records-window';movable(main,main.querySelector('.titlebar'));
document.querySelector('#minimize-main').onclick=()=>minimize(main,'Brother Health Records - Main');
maximize.onclick=()=>{
  const isMaximized=main.classList.contains('maximized');
  if(isMaximized){main.classList.remove('maximized');main.style.cssText=beforeMaximize||'';constrain(main);}
  else{beforeMaximize=main.style.cssText;main.style.cssText='';main.classList.add('maximized');}
  maximize.setAttribute('aria-pressed',String(!isMaximized));maximize.setAttribute('aria-label',isMaximized?'Maximize window':'Restore window');maximize.title=isMaximized?'Maximize window':'Restore window';maximize.textContent=isMaximized?'□':'▣';
};
for(const dialog of document.querySelectorAll('dialog')){
  if(dialog.dataset.simple==='true')continue;
  const title=dialog.querySelector('.dialog-title'),name=title.textContent,button=document.createElement('button');button.type='button';button.className='window-control';button.textContent='−';button.setAttribute('aria-label','Minimize '+name);button.onclick=()=>minimize(dialog,title.querySelector('#person-dialog-title')?.textContent||name);title.prepend(button);movable(dialog,title);
}
new ResizeObserver(layout).observe(menu);window.addEventListener('resize',layout);layout();
