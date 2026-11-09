// Account information is session-only; display names never determine ownership.
const toggle=document.querySelector('#account-toggle'),pane=document.querySelector('#account-pane'),edit=document.querySelector('#account-edit-name');
let signedIn=false,onEdit=()=>{};
export function closeAccountMenu(restoreFocus=false){pane.hidden=true;toggle.setAttribute('aria-expanded','false');if(restoreFocus)toggle.focus();}
export function updateAccountMenu(user){signedIn=Boolean(user);toggle.disabled=!signedIn;document.querySelector('#account-email').textContent=user?(user.email||'Email unavailable'):'';document.querySelector('#account-display-name').textContent=user?.name||'';if(!signedIn)closeAccountMenu();}
export function initAccountMenu(callback){onEdit=callback;}
function open(){if(!signedIn)return;pane.hidden=false;toggle.setAttribute('aria-expanded','true');}
toggle.addEventListener('click',()=>pane.hidden?open():closeAccountMenu());
toggle.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&signedIn){event.preventDefault();open();edit.focus();}});
edit.addEventListener('click',()=>{if(!signedIn)return;closeAccountMenu();onEdit();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!pane.hidden){event.preventDefault();closeAccountMenu(true);}});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.account-menu'))closeAccountMenu();});
document.addEventListener('focusin',event=>{if(!event.target.closest('.account-menu'))closeAccountMenu();});
updateAccountMenu(null);
