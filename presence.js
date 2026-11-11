// Presence transport boundary. Drive today; a later server provider can use
// subscribe(onUsers) => unsubscribe, emitting [{id, name, email}] for active sessions.
// Shared Drive transport is installed by app.js; providers may also report status.
const button=document.querySelector('#connected-users'),pane=document.querySelector('#connected-users-pane'),list=document.querySelector('#connected-users-list');
let sessionUser=null,unsubscribe=null,provider=null,generation=0;
function render(users,status={}){
  const unique=new Map();
  for(const user of users||[])if(user?.id)unique.set(user.id,user);
  button.textContent=`Connected Users: ${status.error?'?':status.loading?'…':unique.size}`;
  list.replaceChildren();
  for(const user of unique.values()){const item=document.createElement('li');item.textContent=(user.name||'Connected user')+(user.email?' ('+user.email+')':'');list.append(item);}
  document.querySelector('#presence-scope').textContent=status.scope||(provider?'Connected sessions':'This browser session');
}
export function closePresence(){pane.hidden=true;button.setAttribute('aria-expanded','false');}
export function setPresenceProvider(next){
  generation++;unsubscribe?.();unsubscribe=null;provider=next;
  render([]);
  if(sessionUser)subscribe();
}
function subscribe(){
  if(!provider){render(sessionUser?[sessionUser]:[]);return;}
  const current=++generation;
  unsubscribe=provider.subscribe((users,status)=>{if(current===generation&&sessionUser)render(users,status);});
}
export function updateSessionPresence(user){
  if(sessionUser?.id===user?.id&&sessionUser?.name===user?.name&&sessionUser?.email===user?.email)return;
  generation++;unsubscribe?.();unsubscribe=null;sessionUser=user;
  if(user)subscribe();else{render([]);closePresence();}
}
button.addEventListener('click',()=>{pane.hidden=!pane.hidden;button.setAttribute('aria-expanded',String(!pane.hidden));if(!pane.hidden)void provider?.refresh?.();});
button.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();pane.hidden=false;button.setAttribute('aria-expanded','true');void provider?.refresh?.();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!pane.hidden){closePresence();button.focus();}});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.presence-menu'))closePresence();});
document.addEventListener('focusin',event=>{if(!event.target.closest('.presence-menu'))closePresence();});
render([]);
