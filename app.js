import {emptyDirectory,validateDirectory,personName,birthDateError,parseFolder} from './model.js?v=0.2.4';
import {prepareGoogle,authorize,syncDirectory,disconnect,preparePicker,pickFolder} from './drive.js?v=0.2.4';
const $=s=>document.querySelector(s),KEY='infirmary.directory.v1';
let data=emptyDirectory(),selected,storageFailed=false;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6000);}
try{const stored=localStorage.getItem(KEY);if(stored)data=validateDirectory(JSON.parse(stored));}catch{storageFailed=true;toast('Stored data could not be read. Existing storage has been preserved; reload after resolving the problem.');}
function save(next){if(storageFailed){toast('Storage is unavailable. Existing data is protected.');return false;}try{localStorage.setItem(KEY,JSON.stringify(next));data=next;$('#storage-status').textContent='Saved on this device';return true;}catch{toast('Could not save: device storage is unavailable or full. Export your existing records.');return false;}}
function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function render(){
  const query=$('#search').value.toLowerCase();const people=data.people.filter(p=>[personName(p),p.firstName,p.lastName,p.preferredName,p.name].filter(Boolean).join(' ').toLowerCase().includes(query)).sort((a,b)=>(a.lastName||personName(a)).localeCompare(b.lastName||personName(b)));
  $('#people').replaceChildren();
  for(const p of people){const button=element('button',undefined,'person'+(selected===p.id?' selected':''));button.type='button';button.setAttribute('aria-pressed',String(selected===p.id));button.append(element('strong',personName(p)));const fullName=[p.firstName,p.lastName].filter(Boolean).join(' ');if(fullName && fullName!==personName(p))button.append(element('span',fullName));button.onclick=()=>{selected=p.id;render();};$('#people').append(button);}
  if(!people.length)$('#people').append(element('p',query?'No matching people.':'Your directory is empty.','empty'));
  $('#people-count').textContent=`${data.people.length} ${data.people.length===1?'person':'people'} in directory`;
  const panel=$('#detail');panel.replaceChildren();const person=data.people.find(p=>p.id===selected);
  if(!person){const blank=element('div',undefined,'empty');blank.append(element('div','▤','empty-icon'),element('h2','A place for everyday care'),element('p','Add a person to begin, or connect Google Drive to pull an existing directory.'));panel.append(blank);return;}
  const header=element('div',undefined,'person-header'),title=element('div');title.append(element('div','PERSON RECORD','eyebrow'),element('h2',personName(person)));header.append(element('div',personName(person).split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),'avatar'),title);panel.append(header);
  const legalName=[person.firstName,person.lastName].filter(Boolean).join(' ');
  if(legalName && legalName!==personName(person))panel.append(element('p',legalName,'muted'));
  if(person.birthDate && Object.values(person.birthDate).some(Boolean)){const b=person.birthDate;panel.append(element('p',`Date of birth: ${b.month||'—'} / ${b.day||'—'} / ${b.year||'—'}`,'muted'));}
  const folderSection=element('section',undefined,'person-folders'),folderHeading=element('div',undefined,'notes-heading'),attach=element('button','Attach folder…');attach.type='button';attach.onclick=()=>openPersonFolder(person.id);folderHeading.append(element('h3','Drive folders'),attach);folderSection.append(folderHeading);
  for(const folder of person.driveFolders||[]){const link=element('a',folder.name||'Drive folder','folder-link');link.href=`https://drive.google.com/drive/folders/${encodeURIComponent(folder.id)}`;link.target='_blank';link.rel='noopener noreferrer';folderSection.append(link);}
  if(!person.driveFolders?.length)folderSection.append(element('p','No folders attached.','muted'));panel.append(folderSection);
  if(person.info)panel.append(element('p',person.info,'info'));
  const heading=element('div',undefined,'notes-heading');heading.append(element('h3','Chronological notes'),element('span',`${person.notes.length} entries`,'muted'));panel.append(heading);
  const form=element('form',undefined,'note-form'),input=element('input');input.required=true;input.maxLength=10000;input.placeholder='Type a note and press Enter…';input.setAttribute('aria-label','New note');input.autocomplete='off';const submit=element('button','Add');submit.type='submit';form.append(input,submit);panel.append(form,element('p','Each note is timestamped when added. Oldest entries appear first.','hint'));
  const notes=element('ol',undefined,'notes');for(const note of [...person.notes].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id))){const li=element('li',undefined,'note'),time=element('time',new Date(note.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}));time.dateTime=note.createdAt;li.append(time,element('p',note.text));notes.append(li);}if(!person.notes.length)notes.append(element('li','No notes yet. Add the first entry above.','empty'));panel.append(notes);
  form.onsubmit=event=>{event.preventDefault();const text=input.value.trim();if(!text)return;const next=structuredClone(data),p=next.people.find(p=>p.id===selected),now=new Date().toISOString();p.notes.push({id:crypto.randomUUID(),text,createdAt:now});p.updatedAt=now;if(save(next)){render();$('.note-form input').focus();$('.notes').scrollTop=$('.notes').scrollHeight;}};
}
selected=data.people[0]?.id;render();
$('#search').oninput=render;
$('#add-person').onclick=()=>{$('#person-dialog').showModal();$('#person-form input').focus();};
$('#person-form').onsubmit=e=>{
  e.preventDefault();const form=new FormData(e.target);
  const firstName=form.get('firstName').trim(),lastName=form.get('lastName').trim(),preferredName=form.get('preferredName').trim();
  const birthDate={month:form.get('birthMonth'),day:form.get('birthDay'),year:form.get('birthYear')};
  const error=(!firstName&&!lastName&&!preferredName)?'Enter at least one name.':birthDateError(birthDate);
  $('#person-error').textContent=error;if(error)return;
  const id=crypto.randomUUID(),next=structuredClone(data),person={id,firstName,lastName,preferredName,birthDate,info:form.get('info').trim(),updatedAt:new Date().toISOString(),notes:[],driveFolders:[]};person.name=personName(person);next.people.push(person);
  if(save(next)){selected=id;$('#search').value='';render();e.target.reset();$('#person-error').textContent='';$('#person-dialog').close();}
};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>document.getElementById(button.dataset.close).close();
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download='people_directory.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let driveConfig={...window.INFIRMARY_CONFIG},googleReady=false,googleLoading=false,connecting=false,connected=false,pickerReady=false,folderTarget;
try{
  const remembered=JSON.parse(localStorage.getItem('infirmary.drive')||'{}');
  driveConfig={...remembered,...Object.fromEntries(Object.entries(driveConfig).filter(([,value])=>value))};
}catch{}
function fillSettings(){
  $('#sync-folder-name').textContent=driveConfig.folder?(driveConfig.folderName||'Directory folder selected'):'No directory folder selected';
  $('#google-connect').disabled=connecting;
  $('#google-connect').setAttribute('aria-busy',String(connecting));
  $('#choose-sync-folder').disabled=!connected||!pickerReady;
  $('#use-drive-root').disabled=!connected;
  $('#sync').disabled=!connected||!driveConfig.folder;
}
fillSettings();
function rememberSettings(){try{localStorage.setItem('infirmary.drive',JSON.stringify(driveConfig));}catch{toast('Connection settings could not be remembered on this device.');}}
const missingGoogleSetup='Google Drive is not connected yet. The site administrator needs to finish Google sign-in setup. Your local records are still available.';
async function readyGoogle(){
  if(googleLoading)return;
  if(!driveConfig.clientId){$('#drive-status').textContent=missingGoogleSetup;return;}
  googleLoading=true;$('#drive-status').textContent='Preparing Google sign-in…';
  try{await prepareGoogle();googleReady=true;$('#drive-status').textContent=connected?'Connected to Google Drive.':'Ready. Continue with Google to sign in.';}
  catch(error){$('#drive-status').textContent=error.message+' Click Continue with Google to retry.';}
  finally{googleLoading=false;fillSettings();}
  if(googleReady&&driveConfig.pickerApiKey&&driveConfig.projectNumber){try{await preparePicker();pickerReady=true;}catch(error){$('#drive-status').textContent=error.message;}fillSettings();}
}
$('#drive-open').onclick=()=>{$('#drive-dialog').showModal();fillSettings();readyGoogle();};
$('#google-connect').onclick=async()=>{
  if(!driveConfig.clientId){$('#drive-status').textContent=missingGoogleSetup;return;}
  if(googleLoading){$('#drive-status').textContent='Google sign-in is loading. Please try again in a moment.';return;}
  // A ready SDK lets OAuth open directly from this click, avoiding popup blockers.
  if(!googleReady){await readyGoogle();return;}
  connecting=true;fillSettings();$('#drive-status').textContent='Complete sign-in in the Google window. Close it to cancel.';
  try{await authorize(driveConfig.clientId);connected=true;$('#drive-status').textContent=pickerReady?'Connected. Choose a directory folder, then sync.':'Connected. Use My Drive (root), or configure Google folder browsing.';}
  catch(error){connected=false;$('#drive-status').textContent=error.message;}
  finally{connecting=false;fillSettings();}
};
async function chooseFolder(dialog){
  // Native Google Picker must appear above the app, outside a modal's top layer.
  dialog.close();try{return await pickFolder(driveConfig);}finally{dialog.showModal();}
}
$('#choose-sync-folder').onclick=async()=>{try{await authorize(driveConfig.clientId);const folder=await chooseFolder($('#drive-dialog'));if(folder){driveConfig.folder=folder.id;driveConfig.folderName=folder.name;rememberSettings();fillSettings();$('#drive-status').textContent='Directory folder selected. Choose Sync directory to merge your records.';}}catch(error){$('#drive-status').textContent=error.message;}};
$('#use-drive-root').onclick=()=>{driveConfig.folder='root';driveConfig.folderName='My Drive (root)';rememberSettings();fillSettings();$('#drive-status').textContent='My Drive selected. Sync directory will save people_directory.json at the top level of My Drive.';};
$('#disconnect').onclick=()=>{disconnect();connected=false;fillSettings();$('#connection').textContent='Local workspace';$('#drive-status').textContent='Disconnected. Local records and attached folder links are retained.';};
$('#sync').onclick=async()=>{
  if(storageFailed){$('#drive-status').textContent='Resolve local storage before syncing.';return;}
  $('#sync').disabled=true;$('#disconnect').disabled=true;$('.workspace').inert=true;$('#drive-status').textContent='Merging directory with Google Drive…';
  try{await authorize(driveConfig.clientId);const merged=await syncDirectory(driveConfig.folder,data);if(!save(merged))throw new Error('Drive synced, but local storage failed. Export records before closing.');selected=selected||data.people[0]?.id;render();$('#connection').textContent='Last synced '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});$('#drive-status').textContent='Sync complete. Your records are saved on this device and in Drive.';}
  catch(error){$('#drive-status').textContent=error.message;}finally{fillSettings();$('#disconnect').disabled=false;$('.workspace').inert=storageFailed;}
};
function openPersonFolder(id){folderTarget=id;$('#folder-form').reset();$('#folder-error').textContent='';$('#folder-dialog').showModal();}
function attachFolder(folder){
  const next=structuredClone(data),person=next.people.find(p=>p.id===folderTarget);if(!person)throw new Error('Select a person first.');
  if(person.driveFolders?.some(existing=>existing.id===folder.id))throw new Error('This folder is already attached.');
  person.driveFolders=[...(person.driveFolders||[]),folder];person.updatedAt=new Date().toISOString();
  if(save(next)){render();$('#folder-dialog').close();return true;}return false;
}
$('#folder-form').onsubmit=event=>{event.preventDefault();try{const form=new FormData(event.target),id=parseFolder(form.get('url'));attachFolder({id,name:form.get('label').trim()||'Drive folder'});}catch(error){$('#folder-error').textContent=error.message;}};
$('#pick-person-folder').onclick=async()=>{
  if(!connected||!pickerReady){$('#folder-error').textContent='Connect Google Drive and configure its folder picker first, or paste a folder link below.';return;}
  try{await authorize(driveConfig.clientId);const folder=await chooseFolder($('#folder-dialog'));if(folder)attachFolder(folder);}catch(error){$('#folder-error').textContent=error.message;}
};
window.addEventListener('storage',event=>{if(event.key===KEY){toast('Records changed in another tab. Reload this tab before editing.');storageFailed=true;$('.workspace').inert=true;}});
function connection(){if(!navigator.onLine)$('#connection').textContent='Offline · local notes available';else if($('#connection').textContent.startsWith('Offline'))$('#connection').textContent='Local workspace';}window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Offline caching unavailable. Use HTTPS or localhost.'));
