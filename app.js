import {emptyDirectory,validateDirectory} from './model.js';
import {prepareGoogle,authorize,syncDirectory,disconnect} from './drive.js';
const $=s=>document.querySelector(s),KEY='infirmary.directory.v1';
let data=emptyDirectory(),selected,storageFailed=false;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6000);}
try{const stored=localStorage.getItem(KEY);if(stored)data=validateDirectory(JSON.parse(stored));}catch{storageFailed=true;toast('Stored data could not be read. Existing storage has been preserved; reload after resolving the problem.');}
function save(next){if(storageFailed){toast('Storage is unavailable. Existing data is protected.');return false;}try{localStorage.setItem(KEY,JSON.stringify(next));data=next;$('#storage-status').textContent='Saved on this device';return true;}catch{toast('Could not save: device storage is unavailable or full. Export your existing records.');return false;}}
function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function render(){
  const query=$('#search').value.toLowerCase();const people=data.people.filter(p=>(p.name+' '+p.room).toLowerCase().includes(query)).sort((a,b)=>a.name.localeCompare(b.name));
  $('#people').replaceChildren();
  for(const p of people){const button=element('button',undefined,'person'+(selected===p.id?' selected':''));button.type='button';button.setAttribute('aria-pressed',String(selected===p.id));button.append(element('strong',p.name),element('span',p.room||'No location entered'));button.onclick=()=>{selected=p.id;render();};$('#people').append(button);}
  if(!people.length)$('#people').append(element('p',query?'No matching people.':'Your directory is empty.','empty'));
  $('#people-count').textContent=`${data.people.length} ${data.people.length===1?'person':'people'} in directory`;
  const panel=$('#detail');panel.replaceChildren();const person=data.people.find(p=>p.id===selected);
  if(!person){const blank=element('div',undefined,'empty');blank.append(element('div','▤','empty-icon'),element('h2','A place for everyday care'),element('p','Add a person to begin, or connect Google Drive to pull an existing directory.'));panel.append(blank);return;}
  const header=element('div',undefined,'person-header'),title=element('div');title.append(element('div','PERSON RECORD','eyebrow'),element('h2',person.name),element('div',person.room||'Location not entered','muted'));header.append(element('div',person.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),'avatar'),title);panel.append(header);
  if(person.info)panel.append(element('p',person.info,'info'));
  const heading=element('div',undefined,'notes-heading');heading.append(element('h3','Chronological notes'),element('span',`${person.notes.length} entries`,'muted'));panel.append(heading);
  const form=element('form',undefined,'note-form'),input=element('input');input.required=true;input.maxLength=10000;input.placeholder='Type a note and press Enter…';input.setAttribute('aria-label','New note');input.autocomplete='off';const submit=element('button','Add');submit.type='submit';form.append(input,submit);panel.append(form,element('p','Each note is timestamped when added. Oldest entries appear first.','hint'));
  const notes=element('ol',undefined,'notes');for(const note of [...person.notes].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id))){const li=element('li',undefined,'note'),time=element('time',new Date(note.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}));time.dateTime=note.createdAt;li.append(time,element('p',note.text));notes.append(li);}if(!person.notes.length)notes.append(element('li','No notes yet. Add the first entry above.','empty'));panel.append(notes);
  form.onsubmit=event=>{event.preventDefault();const text=input.value.trim();if(!text)return;const next=structuredClone(data),p=next.people.find(p=>p.id===selected),now=new Date().toISOString();p.notes.push({id:crypto.randomUUID(),text,createdAt:now});p.updatedAt=now;if(save(next)){render();$('.note-form input').focus();$('.notes').scrollTop=$('.notes').scrollHeight;}};
}
selected=data.people[0]?.id;render();
$('#search').oninput=render;
$('#add-person').onclick=()=>{$('#person-dialog').showModal();$('#person-form input').focus();};
$('#person-form').onsubmit=e=>{e.preventDefault();const form=new FormData(e.target),name=form.get('name').trim();if(!name)return;const id=crypto.randomUUID(),next=structuredClone(data);next.people.push({id,name,room:form.get('room').trim(),info:form.get('info').trim(),updatedAt:new Date().toISOString(),notes:[]});if(save(next)){selected=id;$('#search').value='';render();e.target.reset();$('#person-dialog').close();}};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>document.getElementById(button.dataset.close).close();
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download='people_directory.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
try{const config=JSON.parse(localStorage.getItem('infirmary.drive')||'{}');$('#client-id').value=config.clientId||'';$('#folder-id').value=config.folder||'';}catch{}
let googleReady=false;
$('#drive-open').onclick=()=>{$('#drive-dialog').showModal();if(!googleReady){$('#sync').disabled=true;$('#drive-status').textContent='Loading Google sign-in…';prepareGoogle().then(()=>{googleReady=true;$('#drive-status').textContent='Ready to connect. Your access token stays in memory only.';}).catch(e=>$('#drive-status').textContent=e.message).finally(()=>$('#sync').disabled=false);}};
$('#disconnect').onclick=()=>{disconnect();$('#connection').textContent='Local workspace';$('#drive-status').textContent='Disconnected. Local records are retained. To revoke this app’s grant, use your Google Account permissions.';};
$('#drive-form').onsubmit=async event=>{event.preventDefault();if(!googleReady){$('#drive-status').textContent='Reopen this dialog to retry loading Google sign-in.';return;}if(storageFailed){$('#drive-status').textContent='Resolve local storage before syncing.';return;}const clientId=$('#client-id').value.trim(),folder=$('#folder-id').value.trim();if(!clientId.endsWith('.apps.googleusercontent.com')){$('#drive-status').textContent='Enter a Google OAuth web client ID.';return;}
  $('#sync').disabled=true;$('#disconnect').disabled=true;$('.workspace').inert=true;$('#drive-status').textContent='Connecting and merging directory…';
  try{await authorize(clientId);localStorage.setItem('infirmary.drive',JSON.stringify({clientId,folder}));const merged=await syncDirectory(folder,data);if(!save(merged))throw new Error('Drive synced, but local storage failed. Export records before closing.');selected=selected||data.people[0]?.id;render();$('#connection').textContent='Last synced '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});$('#drive-status').textContent='Sync complete. Local and Drive notes have been merged.';}
  catch(error){$('#drive-status').textContent=error.message;}finally{$('#sync').disabled=false;$('#disconnect').disabled=false;$('.workspace').inert=false;}
};
window.addEventListener('storage',event=>{if(event.key===KEY){toast('Records changed in another tab. Reload this tab before editing.');storageFailed=true;$('.workspace').inert=true;}});
function connection(){if(!navigator.onLine)$('#connection').textContent='Offline · local notes available';else if($('#connection').textContent.startsWith('Offline'))$('#connection').textContent='Local workspace';}window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
$('#clock').textContent=new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Offline caching unavailable. Use HTTPS or localhost.'));
