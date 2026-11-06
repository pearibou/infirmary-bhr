// System 7 application menu; existing action handlers remain on the menu items.
const toggle=document.querySelector('#app-menu-toggle'),menu=document.querySelector('#app-menu');
const items=()=>[...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
export function closeAppMenu(restoreFocus=false){menu.hidden=true;toggle.setAttribute('aria-expanded','false');if(restoreFocus)toggle.focus();}
function openMenu(position){menu.hidden=false;toggle.setAttribute('aria-expanded','true');if(position!==undefined){const enabled=items();enabled.at(position)?.focus();}}
toggle.addEventListener('click',()=>menu.hidden?openMenu():closeAppMenu());
toggle.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();openMenu(event.key==='ArrowDown'?0:-1);}else if(event.key==='Escape'){event.preventDefault();closeAppMenu(true);}});
menu.addEventListener('keydown',event=>{
  const enabled=items(),index=enabled.indexOf(document.activeElement);
  if(event.key==='Escape'){event.preventDefault();closeAppMenu(true);return;}
  let next;
  if(event.key==='ArrowDown')next=(index+1)%enabled.length;
  if(event.key==='ArrowUp')next=(index-1+enabled.length)%enabled.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=enabled.length-1;
  if(next!==undefined){event.preventDefault();enabled[next]?.focus();}
});
for(const item of menu.querySelectorAll('[role="menuitem"]'))item.addEventListener('click',()=>closeAppMenu(item.id==='export'));
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.application-menu'))closeAppMenu();});
document.addEventListener('focusin',event=>{if(!event.target.closest('.application-menu'))closeAppMenu();});
