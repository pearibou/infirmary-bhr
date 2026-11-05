// Window controls remain usable without Google services.
const dock=document.querySelector('#window-dock');
function reset(win){for(const key of ['position','left','top','width','height','margin'])win.style[key]='';}
function movable(win,bar){
  bar.tabIndex=0;bar.title='Drag to move; arrow keys move this window';
  function move(left,top){const rect=win.getBoundingClientRect(),menu=document.querySelector('.menubar').getBoundingClientRect();Object.assign(win.style,{position:'fixed',margin:'0',width:`${rect.width}px`,left:`${Math.max(0,Math.min(left,innerWidth-rect.width))}px`,top:`${Math.max(menu.bottom,Math.min(top,innerHeight-40))}px`});}
  bar.addEventListener('pointerdown',event=>{
    if(event.target.closest('button')||event.button!==0)return;
    const rect=win.getBoundingClientRect(),x=event.clientX,y=event.clientY;
    bar.setPointerCapture(event.pointerId);
    const drag=e=>move(rect.left+e.clientX-x,rect.top+e.clientY-y);
    const stop=()=>{bar.removeEventListener('pointermove',drag);bar.removeEventListener('pointerup',stop);bar.removeEventListener('pointercancel',stop);};
    bar.addEventListener('pointermove',drag);bar.addEventListener('pointerup',stop);bar.addEventListener('pointercancel',stop);event.preventDefault();
  });
  bar.addEventListener('keydown',event=>{if(event.target!==bar || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const rect=win.getBoundingClientRect();move(rect.left+(event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0),rect.top+(event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0));});
}
function minimize(win,title){
  if(dock.querySelector(`[data-window="${win.id}"]`))return;
  if(win instanceof HTMLDialogElement)win.close();else win.hidden=true;
  const restore=document.createElement('button');restore.textContent=`▣ ${title}`;restore.dataset.window=win.id;restore.title='Restore '+title;
  restore.onclick=()=>{if(win instanceof HTMLDialogElement)win.showModal();else win.hidden=false;restore.remove();win.querySelector('.titlebar,.dialog-title')?.focus();};dock.append(restore);restore.focus();
}
const main=document.querySelector('.window');main.id='records-window';movable(main,main.querySelector('.titlebar'));
document.querySelector('#minimize-main').onclick=()=>minimize(main,'Brother Health Records');
document.querySelector('#reset-main').onclick=()=>reset(main);
for(const dialog of document.querySelectorAll('dialog')){
  const title=dialog.querySelector('.dialog-title'),name=title.textContent,button=document.createElement('button');button.type='button';button.className='window-control';button.textContent='−';button.setAttribute('aria-label','Minimize '+name);button.onclick=()=>minimize(dialog,name);title.prepend(button);movable(dialog,title);
}
window.addEventListener('resize',()=>{reset(main);for(const dialog of document.querySelectorAll('dialog'))reset(dialog);});
