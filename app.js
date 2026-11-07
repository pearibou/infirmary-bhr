import {initBackground} from './background.js?v=0.12.1';
import {initHistory,historySession,openHistory} from './history.js?v=0.12.1';
import {smallIcon,decoratePrintButtons} from './icons-ui.js?v=0.12.1';
import {printDocument} from './printing.js?v=0.12.1';
import {initDemographics,fillAdditional,readAdditional,openDemographics,clearDemographics} from './demographics.js?v=0.12.1';
import {initMedications,medicationsSession,openMedications} from './medications.js?v=0.12.1';
import {initDocuments,documentsSession,refreshFiles,chartDocuments} from './documents.js?v=0.12.1';
import {updateSessionPresence} from './presence.js?v=0.12.1';
import {closeAppMenu} from './app-menu.js?v=0.12.1';
import {recordChanges,createEvent,mergeEventLogs} from './events.js?v=0.12.1';
import {initDesktopNotes,renderDesktopNotes,closeDesktopMenu} from './sticky.js?v=0.12.1';
import {makeTrashable,clearTrashSelection,finishEntryDrag} from './trash.js?v=0.12.1';
import {validatePhoto} from './photos.js?v=0.12.1';
import './windows.js?v=0.12.1';
import {emptyDirectory,validateDirectory,personName,birthDateError,parseFolder,mergeDirectories,personAge,deathDateError,currentNoteText,currentNoteTime,canEditNote,editNote,deleteDirectoryEntry,compareDirectoryPeople,deathDateParts,formatDeathDate} from './model.js?v=0.12.1';
import {prepareGoogle,authorize,syncDirectory,ensureWorkspaceFolder,getWorkspaceFolder,disconnect,preparePicker,pickFolder,hasDriveAccess,uploadPersonFile,getCurrentUser,loadCurrentUser,readPersonPhoto} from './drive.js?v=0.12.1';
const $=s=>document.querySelector(s),KEY='infirmary.directory.v1',LOGOUT_KEY='infirmary.logout';
let data=emptyDirectory(),selected,storageFailed=false,editPersonId=null,personSaveBusy=false,photoPreviewUrl,noteEditTarget,workspaceReady=false,choosingFolder=false,deceasedCollapsed=false,sessionEpoch=0,sessionCleared=false;
try{deceasedCollapsed=localStorage.getItem('infirmary.deceasedCollapsed')==='true';}catch{}
const photoUrls=new Map();let photoGeneration=0;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6000);}
try{const stored=localStorage.getItem(KEY);if(stored)data=validateDirectory(JSON.parse(stored));}catch{storageFailed=true;toast('Stored data could not be read. Existing storage has been preserved; reload after resolving the problem.');}
function save(next,fromSync=false){if(sessionCleared)return false;if(!fromSync&&(!workspaceReady||!hasDriveAccess())){if(workspaceReady)lockWorkspace();toast('Connect Google Drive and sync the directory first.');return false;}if(storageFailed){toast('Storage is unavailable. Existing data is protected.');return false;}try{if(!fromSync)next=recordChanges(data,next,getCurrentUser());localStorage.setItem(KEY,JSON.stringify(next));data=next;refreshEventLog();$('#storage-status').textContent='Saved on this device';return true;}catch{toast('Could not save: device storage is unavailable or full. Export your existing records.');return false;}}
function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function render(){
  if(selected&&!data.people.some(person=>person.id===selected))selected=[...data.people].sort(compareDirectoryPeople)[0]?.id;
  refreshEventLog();clearTrashSelection();renderDesktopNotes(data.desktopNotes||[]);
  const query=$('#search').value.toLowerCase();const people=data.people.filter(p=>[personName(p),p.firstName,p.middleName,p.lastName,p.preferredName,p.name].filter(Boolean).join(' ').toLowerCase().includes(query)).sort(compareDirectoryPeople);
  $('#people').replaceChildren();
  let deceasedSection=false;const deceasedCount=people.filter(person=>person.deceased).length;
  for(const p of people){
    if(p.deceased&&!deceasedSection){
      deceasedSection=true;const divider=element('button',`${deceasedCollapsed?'▸':'▾'} Deceased (${deceasedCount})`,'directory-divider');divider.type='button';divider.setAttribute('aria-expanded',String(!deceasedCollapsed));divider.setAttribute('aria-label',deceasedCollapsed?'Show deceased people':'Hide deceased people');
      divider.onclick=()=>{deceasedCollapsed=!deceasedCollapsed;try{localStorage.setItem('infirmary.deceasedCollapsed',String(deceasedCollapsed));}catch{}renderKeepingDraft();$('#people .directory-divider')?.focus();};$('#people').append(divider);
    }
    if(p.deceased&&deceasedCollapsed)continue;
    const button=element('button',undefined,'person'+(selected===p.id?' selected':''));button.type='button';button.setAttribute('aria-pressed',String(selected===p.id));button.append(element('strong',personName(p)));const fullName=[p.firstName,p.middleName,p.lastName].filter(Boolean).join(' ');if(fullName && fullName!==personName(p))button.append(element('span',fullName));button.onclick=()=>{selected=p.id;render();};makeTrashable(button,{personId:p.id});const row=element('div',undefined,'person-row'+(p.deceased?' deceased-row':'')),edit=element('button','✎','record-pencil');edit.type='button';edit.title='Edit record';edit.setAttribute('aria-label','Edit record for '+personName(p));edit.onclick=()=>openPerson(p.id);row.append(button,edit);$('#people').append(row);
  }
  if(!people.length)$('#people').append(element('p',query?'No matching people.':'Your directory is empty.','empty'));
  $('#people-count').textContent=`${data.people.length} ${data.people.length===1?'person':'people'} in directory`;
  const panel=$('#detail');panel.replaceChildren();const person=data.people.find(p=>p.id===selected);
  if(!person){const blank=element('div',undefined,'empty');blank.append(element('div','▤','empty-icon'),element('h2','A place for everyday care'),element('p','Add a person to begin, or connect Google Drive to pull an existing directory.'));panel.append(blank);return;}
  const header=element('div',undefined,'person-header'),title=element('div'),avatar=makeAvatar(person);
  title.append(element('div','PERSON RECORD','eyebrow'),element('h2',personName(person)));
  const editRecord=element('button','✎','record-pencil');editRecord.type='button';editRecord.title='Edit record';editRecord.setAttribute('aria-label','Edit this record');editRecord.onclick=()=>openPerson(person.id);
  const avatarGroup=element('div',undefined,'avatar-group');avatarGroup.append(avatar);if(person.deceased)avatarGroup.append(makeCrucifix());
  const recordActions=element('div',undefined,'record-actions'),upload=element('button','Upload file…');upload.type='button';upload.onclick=()=>openUpload(person.id);recordActions.append(editRecord,upload);header.append(avatarGroup,title,recordActions);panel.append(header);
  const navigation=element('nav',undefined,'chart-navigation');navigation.setAttribute('aria-label','Chart sections');
  for(const section of ['Demographics','Medications','Medical History']){const item=element('button',section);item.type='button';item.setAttribute('aria-haspopup','dialog');item.onclick=()=>{if(section==='Demographics'){openDemographics(person.id);return;}if(section==='Medications'){openMedications(person.id);return;}if(section==='Medical History'){openHistory(person.id);return;}$('#chart-section-title').textContent=section;$('#chart-section-message').textContent=section+' is not available yet.';$('#chart-section-dialog').showModal();};navigation.append(item);}panel.append(navigation);
  const legalName=[person.firstName,person.middleName,person.lastName].filter(Boolean).join(' ');
  if(legalName && legalName!==personName(person))panel.append(element('p',legalName,'muted legal-name'));
  if(person.birthDate && Object.values(person.birthDate).some(Boolean)){const b=person.birthDate;panel.append(element('p',`Date of birth: ${b.month||'—'} / ${b.day||'—'} / ${b.year||'—'}`,'muted'));}
  const age=personAge(person);panel.append(element('p',`${person.deceased?'Age at death':'Age'}: ${age===null?'— (complete dates needed)':age+' years'}`,'muted age'));
  if(person.noKnownAllergies)panel.append(element('p','No known allergies','allergies'));
  else if(person.allergies?.trim())panel.append(element('p','Allergies: '+person.allergies.trim(),'allergies'));
  if(person.deceased)panel.append(element('p',`Date of death: ${formatDeathDate(person.deathDate)}`,'death-status'));
  const folderSection=element('section',undefined,'person-folders'),folderHeading=element('div',undefined,'notes-heading'),attach=element('button','Attach folder…');attach.type='button';attach.onclick=()=>openPersonFolder(person.id);folderHeading.append(element('h3','Drive folders'),attach);folderSection.append(folderHeading);
  for(const folder of person.driveFolders||[]){const link=element('a',folder.name||'Drive folder','folder-link');link.href=`https://drive.google.com/drive/folders/${encodeURIComponent(folder.id)}`;link.target='_blank';link.rel='noopener noreferrer';folderSection.append(link);}
  if(!person.driveFolders?.length)folderSection.append(element('p','No folders attached.','muted'));
  const documents=element('section',undefined,'clinical-documents');panel.append(documents);chartDocuments(documents,person.id);
  if(person.info)panel.append(element('p',person.info,'info'));
  const heading=element('div',undefined,'notes-heading');heading.append(element('h3','Clinical quick notes'),element('span',`${person.notes.length} entries`,'muted'));panel.append(heading);
  const form=element('form',undefined,'note-form'),input=element('input');input.required=true;input.maxLength=10000;input.placeholder='Type a note and press Enter…';input.setAttribute('aria-label','New note');input.autocomplete='off';const submit=element('button','Add');submit.type='submit';form.append(input,submit);panel.append(form,element('p',getCurrentUser()?'Each note records your Google account. Newest entries appear first.':'Connect Google Drive to attribute notes to your account and enable author-only editing. Signed-out notes remain unattributed.','hint'));
  const notes=element('ol',undefined,'notes');
  for(const note of [...person.notes].sort((a,b)=>Date.parse(currentNoteTime(b))-Date.parse(currentNoteTime(a))||a.id.localeCompare(b.id))){
    const li=element('li',undefined,'note');li.tabIndex=0;if(canEditNote(note,getCurrentUser()))makeTrashable(li,{personId:person.id,noteId:note.id},()=>canEditNote(note,getCurrentUser()));else{li.draggable=false;li.title='Only the original author can delete this note';li.addEventListener('dragstart',event=>event.preventDefault());}const meta=element('div',undefined,'note-meta'),time=element('time',formatTime(currentNoteTime(note)));time.dateTime=currentNoteTime(note);
    meta.append(time,element('span','Entered by '+(note.authorName||'Unattributed (legacy or signed out)'),'note-author'));
    if(canEditNote(note,getCurrentUser())){const edit=element('button','✎','note-pencil');edit.type='button';edit.setAttribute('aria-label','Edit your note from '+formatTime(currentNoteTime(note)));edit.onclick=()=>openNoteEditor(person.id,note.id);meta.append(edit);}
    li.append(meta,element('p',currentNoteText(note)));
    if(note.edits?.length)li.append(element('small','Edited '+formatTime(note.edits.at(-1).editedAt),'muted'));
    notes.append(li);
  }
  if(!person.notes.length)notes.append(element('li','No notes yet. Add the first entry above.','empty'));panel.append(notes,folderSection);
  form.onsubmit=event=>{event.preventDefault();const text=input.value.trim();if(!text)return;const next=structuredClone(data),p=next.people.find(p=>p.id===selected),now=new Date().toISOString(),user=getCurrentUser();p.notes.push({id:crypto.randomUUID(),text,createdAt:now,...(user?{authorId:user.id,authorName:user.name}:{})});p.updatedAt=now;if(save(next)){render();$('.note-form input').focus();$('.notes').scrollTop=0;}};

}
selected=[...data.people].sort(compareDirectoryPeople)[0]?.id;render();
$('#search').oninput=render;
$('#add-person').onclick=()=>openPerson();
let recordBaseline;
const recordFields=person=>JSON.stringify(Object.fromEntries(['firstName','middleName','lastName','preferredName','name','birthDate','info','allergies','noKnownAllergies','deceased','deathDate','photo','demographics'].map(key=>[key,person[key]])));
function openPerson(id=null){
  if(personSaveBusy){if(!$('#person-dialog').open)$('#person-dialog').showModal();return;}
  editPersonId=id;const person=data.people.find(p=>p.id===id),form=$('#person-form');form.reset();clearPhotoPreview();
  recordBaseline=person?recordFields(person):null;fillAdditional(person);
  $('#person-dialog-title').textContent=person?'Edit record':'New person';$('#person-dialog .window-control').setAttribute('aria-label',person?'Minimize Edit record':'Minimize New person');$('#person-submit').textContent=person?'Save record':'Add person';$('#person-error').textContent='';
  for(const key of ['firstName','middleName','lastName','preferredName','info','allergies'])form.elements.namedItem(key).value=person?.[key]||'';
  if(person&&!person.firstName&&!person.lastName&&!person.preferredName)form.elements.namedItem('preferredName').value=person.name;
  for(const part of ['Month','Day','Year'])form.elements.namedItem('birth'+part).value=person?.birthDate?.[part.toLowerCase()]||'';
  const death=deathDateParts(person?.deathDate);for(const part of ['Month','Day','Year'])form.elements.namedItem('death'+part).value=death[part.toLowerCase()];
  $('#person-no-known-allergies').checked=Boolean(person?.noKnownAllergies);updateAllergyFields();
  $('#person-deceased').checked=Boolean(person?.deceased);updateDeathFields();
  showPhotoPreview(person);
  if(!$('#person-dialog').open)$('#person-dialog').showModal();form.elements.namedItem('lastName').focus();
}
function updateAllergyFields(){const checked=$('#person-no-known-allergies').checked;$('#allergy-fields').disabled=checked;}
$('#person-no-known-allergies').onchange=updateAllergyFields;
function updateDeathFields(){const enabled=$('#person-deceased').checked;$('#death-fields').disabled=!enabled;$('#death-fields').classList.toggle('enabled',enabled);}
$('#person-deceased').onchange=updateDeathFields;
function clearPhotoPreview(){if(photoPreviewUrl)URL.revokeObjectURL(photoPreviewUrl);photoPreviewUrl=undefined;delete $('#person-photo-preview').dataset.photoFile;$('#person-photo-preview').replaceChildren();}
function showPhotoPreview(person){const preview=$('#person-photo-preview');preview.textContent=person?initials(person):'＋';if(person?.photo)displayPhoto(preview,person);}
$('#person-photo').onchange=async()=>{const file=$('#person-photo').files[0];clearPhotoPreview();if(!file){showPhotoPreview(data.people.find(p=>p.id===editPersonId));return;}try{await validatePhoto(file);if($('#person-photo').files[0]!==file)return;photoPreviewUrl=URL.createObjectURL(file);const image=element('img');image.src=photoPreviewUrl;image.alt='Selected profile photo preview';$('#person-photo-preview').replaceChildren(image);$('#person-error').textContent='';}catch(error){if($('#person-photo').files[0]!==file)return;$('#person-error').textContent=error.message;$('#person-photo').value='';showPhotoPreview(data.people.find(p=>p.id===editPersonId));}};
$('#person-dialog').addEventListener('close',()=>{if(!personSaveBusy)clearPhotoPreview();});
$('#person-form').onsubmit=async event=>{
  event.preventDefault();if(personSaveBusy)return;
  const form=new FormData(event.target),firstName=form.get('firstName').trim(),middleName=form.get('middleName').trim(),lastName=form.get('lastName').trim(),preferredName=form.get('preferredName').trim();
  const birthDate={month:form.get('birthMonth'),day:form.get('birthDay'),year:form.get('birthYear')},deceased=form.get('deceased')==='on',deathDate=deceased?{month:form.get('deathMonth'),day:form.get('deathDay'),year:form.get('deathYear')}:'';
  let demographics;try{demographics=readAdditional();}catch(error){$('#person-error').textContent=error.message;return;}
  const fields={demographics,firstName,middleName,lastName,preferredName,birthDate,deceased,deathDate,info:form.get('info').trim(),allergies:(form.get('allergies')||'').trim(),noKnownAllergies:form.get('noKnownAllergies')==='on'};
  const error=(!firstName&&!lastName&&!preferredName)?'Enter at least one name.':birthDateError(birthDate)||deathDateError(fields);
  $('#person-error').textContent=error;if(error)return;
  const id=editPersonId||crypto.randomUUID(),file=$('#person-photo').files[0];
  const saveEpoch=sessionEpoch;personSaveBusy=true;fillSettings();for(const control of $('#person-form').elements)control.disabled=true;
  try{
    let person=data.people.find(p=>p.id===id);
    if(editPersonId&&!person)throw new Error('This record was deleted while you were editing.');
    if(person&&recordFields(person)!==recordBaseline)throw new Error('This record changed while you were editing. Reopen it to review the latest details.');
    let photo=person?.photo;const folder=person?.driveFolders?.[0]?.id||getWorkspaceFolder();
    if(file){if(!hasDriveAccess())throw new Error('Connect Google Drive before saving a photo. Your form has been kept.');await validatePhoto(file);$('#person-error').textContent='Uploading photo directly to Drive…';const photoActor=getCurrentUser(),uploaded=await uploadPersonFile(folder,file);if(saveEpoch!==sessionEpoch)return;if(uploaded.id)appendActivity('photo.uploaded','file',uploaded.id,'Profile photo uploaded to Drive folder '+folder,id,photoActor);if(!uploaded.id)throw new Error('Google did not return a photo file ID.');photo={fileId:uploaded.id,folderId:folder};}
    const next=structuredClone(data);person=next.people.find(p=>p.id===id);
    if(editPersonId&&!person)throw new Error('This record was deleted during the upload. The photo remains in Drive.');
    if(person&&recordFields(person)!==recordBaseline)throw new Error('This record changed during photo upload. The photo is in Drive; reopen the record before saving details.');
    const updated={...(person||{id,notes:[],driveFolders:[]}),...fields,updatedAt:new Date().toISOString(),...(photo?{photo}:{})};updated.name=personName({...updated,name:''});
    if(person)next.people[next.people.findIndex(p=>p.id===id)]=updated;else next.people.push(updated);
    if(save(next)){selected=id;$('#search').value='';render();$('#person-dialog').close();event.target.reset();clearPhotoPreview();$('#person-error').textContent='';}
  }catch(error){if(saveEpoch===sessionEpoch)$('#person-error').textContent=error.message;}
  finally{personSaveBusy=false;fillSettings();for(const control of $('#person-form').elements)control.disabled=false;updateDeathFields();updateAllergyFields();}
};
function formatTime(value){return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}
function initials(person){return personName(person).split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
function makeCrucifix(){
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 40');icon.setAttribute('class','deceased-crucifix');icon.setAttribute('role','img');icon.setAttribute('aria-label','Deceased — crucifix');icon.setAttribute('focusable','false');
  icon.innerHTML='<path d="M9 1h6v9h8v6h-8v23H9V16H1v-6h8z" fill="currentColor"/><g fill="#eee" stroke="#332332" stroke-width="1"><circle cx="12" cy="10" r="2.3"/><path d="m11 13-6-2-1 2 6 3v9l2 7 2-1-1-7 1-8 6-3-1-2-6 2z"/></g>';
  return icon;
}
function makeAvatar(person){const avatar=element('div',initials(person),'avatar');if(person.photo)displayPhoto(avatar,person);return avatar;}
async function displayPhoto(avatar,person){
  const fileId=person.photo.fileId,generation=photoGeneration;avatar.dataset.photoFile=fileId;if(!hasDriveAccess()){avatar.title='Connect Google Drive to view profile photo';return;}
  try{let pending=photoUrls.get(fileId);if(!pending){pending=readPersonPhoto(fileId).then(blob=>URL.createObjectURL(blob));photoUrls.set(fileId,pending);}
    const url=await pending;if(!avatar.isConnected||!hasDriveAccess()||generation!==photoGeneration||avatar.dataset.photoFile!==fileId)return;const img=element('img');img.alt='Profile photo of '+personName(person);img.src=url;img.onerror=()=>{avatar.textContent=initials(person);avatar.title='Photo unavailable';};avatar.replaceChildren(img);
  }catch{photoUrls.delete(fileId);avatar.title='Photo unavailable; initials shown';}
}
function clearPhotos(){photoGeneration++;for(const pending of photoUrls.values())pending.then(url=>URL.revokeObjectURL(url)).catch(()=>{});photoUrls.clear();}
function renderKeepingDraft(){const input=$('.note-form input'),draft=input?.value,focused=document.activeElement===input;render();if($('.note-form input')&&draft)$('.note-form input').value=draft;if(focused)$('.note-form input')?.focus();}
function openNoteEditor(personId,noteId){const note=data.people.find(p=>p.id===personId)?.notes.find(n=>n.id===noteId);if(!note||!canEditNote(note,getCurrentUser())){toast('Connect the original author’s Google account to edit this note.');return;}noteEditTarget={personId,noteId,baseline:JSON.stringify(note)};$('#note-edit-text').value=currentNoteText(note);$('#note-edit-time').value=localNoteDate(currentNoteTime(note));$('#note-edit-error').textContent='';$('#note-dialog').showModal();$('#note-edit-text').focus();}
$('#note-edit-form').onsubmit=event=>{event.preventDefault();try{if(!noteEditTarget)throw new Error('Only the Google account that entered this note can edit it. Reopen the note first.');const {personId,noteId,baseline}=noteEditTarget,next=structuredClone(data),person=next.people.find(p=>p.id===personId),index=person.notes.findIndex(n=>n.id===noteId),note=person.notes[index];if(JSON.stringify(note)!==baseline)throw new Error('This note changed. Reopen it before editing.');person.notes[index]=editNote(note,getCurrentUser(),$('#note-edit-text').value,new Date().toISOString(),new Date($('#note-edit-time').value).toISOString());person.updatedAt=new Date().toISOString();if(save(next)){$('#note-dialog').close();renderKeepingDraft();}}catch(error){$('#note-edit-error').textContent=error.message;}};
function localNoteDate(iso){const date=new Date(iso);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);}
$('#note-trash').onclick=()=>{if(noteEditTarget)document.dispatchEvent(new CustomEvent('trash-request',{detail:{personId:noteEditTarget.personId,noteId:noteEditTarget.noteId}}));};
$('#note-print').onclick=async()=>{if(!noteEditTarget||!workspaceReady)return;const person=data.people.find(p=>p.id===noteEditTarget.personId),note=person?.notes.find(n=>n.id===noteEditTarget.noteId);if(!note||!canEditNote(note,getCurrentUser()))return;const stamp=sessionEpoch;$('#note-print').disabled=true;try{const date=new Date($('#note-edit-time').value);if(!Number.isFinite(date.getTime()))throw new Error('Enter a valid note date and time.');const text=$('#note-edit-text').value;await printDocument({title:'Clinical quick note',person:structuredClone(person),sections:[{lines:[text]}],subtitle:'Note date: '+date.toLocaleString()+' · Entered by '+note.authorName+(text!==currentNoteText(note)||date.getTime()!==Date.parse(currentNoteTime(note))?' · Unsaved changes':'')});if(stamp===sessionEpoch)appendActivity('note.print_requested','note',note.id,'Quick note print dialog requested',person.id);}catch(error){if(stamp===sessionEpoch)$('#note-edit-error').textContent=error.message;}finally{$('#note-print').disabled=false;}};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>document.getElementById(button.dataset.close).close();
$('#export').onclick=()=>{if(!workspaceReady||!hasDriveAccess()){lockWorkspace();return;}const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download='people_directory.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let driveConfig={...window.INFIRMARY_CONFIG},googleReady=false,googleLoading=false,connecting=false,connected=false,pickerReady=false,folderTarget,syncing=false,syncAgain=false,loggingOut=false,syncPromise=null,uploading=false,uploadPersonId,fileBusy=false;
const externalOperations=new Set();
function externalBusy(name,value){if(value)externalOperations.add(name);else externalOperations.delete(name);fileBusy=externalOperations.size>0;fillSettings();}
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
  $('#sync').disabled=!connected||!driveConfig.folder||syncing;
  $('#manual-sync').disabled=syncing||!workspaceReady;
  $('#export').disabled=!workspaceReady;
  $('#logout-power').disabled=!workspaceReady||loggingOut||personSaveBusy||uploading||fileBusy;
  updateSessionPresence(workspaceReady&&hasDriveAccess()?(getCurrentUser()||{id:'current-session',name:'Connected Google account'}):null);
  $('#manual-sync').setAttribute('aria-busy',String(syncing));
  $('#choose-sync-folder').disabled ||= syncing;
  $('#use-drive-root').disabled ||= syncing;
  $('#disconnect').disabled=syncing;
}
fillSettings();
function rememberSettings(){try{localStorage.setItem('infirmary.drive',JSON.stringify(driveConfig));}catch{toast('Connection settings could not be remembered on this device.');}}
const missingGoogleSetup='Google Drive is not connected yet. The site administrator needs to finish Google sign-in setup. Connect to open the workspace.';
async function readyGoogle(){
  if(googleLoading)return;
  if(!driveConfig.clientId){$('#drive-status').textContent=missingGoogleSetup;return;}
  googleLoading=true;$('#drive-status').textContent='Preparing Google sign-in…';
  try{await prepareGoogle();googleReady=true;$('#drive-status').textContent=connected?'Connected to Google Drive.':'Ready. Continue with Google to sign in.';}
  catch(error){$('#drive-status').textContent=error.message+' Click Continue with Google to retry.';}
  finally{googleLoading=false;fillSettings();}
  if(googleReady&&driveConfig.pickerApiKey&&driveConfig.projectNumber){try{await preparePicker();pickerReady=true;}catch(error){$('#drive-status').textContent=error.message;}fillSettings();}
}
$('#drive-open').onclick=()=>{if(!$('#drive-dialog').open)$('#drive-dialog').showModal();fillSettings();readyGoogle();};
$('#google-connect').onclick=async()=>{
  if(!driveConfig.clientId){$('#drive-status').textContent=missingGoogleSetup;return;}
  if(googleLoading){$('#drive-status').textContent='Google sign-in is loading. Please try again in a moment.';return;}
  // A ready SDK lets OAuth open directly from this click, avoiding popup blockers.
  if(!googleReady){await readyGoogle();return;}
  const authEpoch=sessionEpoch;connecting=true;fillSettings();$('#drive-status').textContent='Complete sign-in in the Google window. Close it to cancel.';
  try{await authorize(driveConfig.clientId);if(authEpoch!==sessionEpoch){disconnect();return;}connected=true;sessionCleared=false;clearPhotos();try{const user=await loadCurrentUser();$('#current-user').textContent='Signed in as '+user.name;}catch(error){$('#current-user').textContent='Author identity unavailable; new notes will be unattributed.';}if(authEpoch!==sessionEpoch){$('#current-user').textContent='';return;}appendActivity('drive.connected','directory',driveConfig.folder||'unselected','Google Drive connection established');renderKeepingDraft();$('#drive-status').textContent=pickerReady?'Connected. Use Infirmary-BHR, or choose its storage location.':'Connected. Use Infirmary-BHR, or choose its storage location.';if(driveConfig.folder&&!workspaceReady)await runSync();}
  catch(error){if(authEpoch!==sessionEpoch)return;connected=false;$('#drive-status').textContent=error.message;}
  finally{connecting=false;fillSettings();}
};
async function chooseFolder(dialog){
  // Native Google Picker must appear above the app, outside a modal's top layer.
  const pickerEpoch=sessionEpoch;choosingFolder=true;dialog.close();try{const folder=await pickFolder(driveConfig);return pickerEpoch===sessionEpoch?folder:null;}finally{choosingFolder=false;if(pickerEpoch===sessionEpoch&&!dialog.open)dialog.showModal();}
}
$('#choose-sync-folder').onclick=async()=>{try{await authorize(driveConfig.clientId);const folder=await chooseFolder($('#drive-dialog'));if(folder){driveConfig.folder=folder.id;driveConfig.folderName=folder.name;rememberSettings();appendActivity('directory.selected','directory',folder.id,'Directory storage folder selected');fillSettings();$('#drive-status').textContent='Directory folder selected. Choose Sync directory to merge your records.';if(!workspaceReady)await runSync();}}catch(error){$('#drive-status').textContent=error.message;}};
$('#use-drive-root').onclick=()=>{driveConfig.folder='root';driveConfig.folderName='Infirmary-BHR';rememberSettings();appendActivity('directory.selected','directory','root','Infirmary-BHR storage selected');fillSettings();$('#drive-status').textContent='Sync will create or reuse Infirmary-BHR and organize existing BHR files there.';if(!workspaceReady)runSync();};
function clearProtectedWorkspace(removeStorage=true){
  if(removeStorage){
    // Remove only BHR data, preserving unrelated origin storage/preferences.
    // Do this before ending the session so a storage failure is retryable.
    localStorage.removeItem('infirmary.drive');
    localStorage.removeItem(KEY);
    if(localStorage.getItem(KEY)!==null)throw new Error('Browser records could not be cleared.');
    try{localStorage.setItem(LOGOUT_KEY,crypto.randomUUID());}catch{} // Removal itself also notifies other tabs.
  }
  sessionEpoch++;sessionCleared=true;syncAgain=false;choosingFolder=false;disconnect();connected=false;
  clearPhotos();clearPhotoPreview();clearTrashSelection();finishEntryDrag();
  data=emptyDirectory();selected=undefined;editPersonId=null;recordBaseline=undefined;noteEditTarget=undefined;folderTarget=undefined;uploadPersonId=undefined;trashTarget=undefined;
  for(const form of document.querySelectorAll('form'))form.reset();
  for(const input of document.querySelectorAll('input:not([type="checkbox"]),textarea'))input.value='';
  $('#upload-folder').replaceChildren();$('#person-deceased').checked=false;updateDeathFields();updateAllergyFields();
  for(const id of ['person-error','folder-error','upload-person-name','upload-status','note-edit-error','trash-entry-label','trash-error','sticky-error','current-user'])$('#'+id).textContent='';
  clearTimeout(toast.timer);$('#toast').textContent='';$('#toast').hidden=true;
  driveConfig={...window.INFIRMARY_CONFIG};
  document.querySelectorAll('#window-dock [data-window$="-dialog"]').forEach(button=>button.remove());
  storageFailed=false;$('.workspace').inert=false;render();lockWorkspace();
  $('#storage-status').textContent='No records stored on this device';$('#connection').textContent='Logged out';
  $('#drive-status').textContent='Logged out. Protected browser data cleared. Connect Google Drive to open BHR again.';
}
function disconnectWorkspace(logout=false){
  if(logout){clearProtectedWorkspace();return;}
  if(!sessionCleared&&connected)appendActivity('drive.disconnected','directory',driveConfig.folder||'unselected','Google Drive disconnected');
  sessionEpoch++;syncAgain=false;disconnect();connected=false;clearPhotos();clearPhotoPreview();
  $('#person-form').reset();$('#upload-form').reset();$('#note-edit-text').value='';$('#sticky-text').value='';if($('.note-form input'))$('.note-form input').value='';
  $('#current-user').textContent='';renderKeepingDraft();fillSettings();$('#connection').textContent='Local workspace';$('#drive-status').textContent=logout?'Logged out. Connect Google Drive to open BHR again.':'Disconnected. Connect Google Drive to reopen the workspace.';lockWorkspace();
}
$('#disconnect').onclick=()=>disconnectWorkspace();
$('#logout-power').onclick=()=>{if(!workspaceReady)return;$('#logout-dialog').showModal();$('#logout-dialog [data-close]').focus();};
$('#confirm-logout').onclick=async()=>{
  if(loggingOut)return;
  if(personSaveBusy||uploading||fileBusy){toast('Wait for the current upload or record save to finish before logging out.');return;}
  loggingOut=true;fillSettings();
  const dialog=$('#logout-dialog'),status=$('#logout-status');
  dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
  status.textContent='Syncing with Google Drive before logging out…';
  try{
    // An existing request used an older snapshot; wait, then send a fresh one.
    if(syncPromise)await syncPromise;
    // Log the request before the final upload; do not create unsynced events
    // after it, since successful logout now removes this browser's copy.
    appendActivity('session.logout_requested','session','current','User confirmed logout; final sync requested');
    if(!await runSync(false,true))throw new Error('Final sync did not complete.');
    status.textContent='Sync complete. Clearing this browser’s protected data…';
    disconnectWorkspace(true);
  }catch(error){status.textContent='Logout did not finish. You are still signed in; local records are retained. Check your connection or browser storage and try Log out again. '+error.message;}
  finally{loggingOut=false;dialog.querySelectorAll('button').forEach(button=>button.disabled=false);fillSettings();}
};
$('#logout-dialog').addEventListener('cancel',event=>{if(loggingOut)event.preventDefault();});
$('#logout-dialog').addEventListener('close',()=>{$('#logout-status').textContent='';});

function runSync(automatic=false,finalLogout=false){
  if(loggingOut&&!finalLogout)return Promise.resolve(false);
  if(syncPromise){syncAgain=true;return syncPromise;}
  syncPromise=performSync(automatic).finally(()=>{
    syncPromise=null;const again=syncAgain;syncAgain=false;
    if(again&&!loggingOut&&workspaceReady&&hasDriveAccess())queueMicrotask(()=>runSync(true));
  });
  return syncPromise;
}
async function performSync(automatic=false){
  if(syncing){syncAgain=true;return;}
  if(storageFailed){if(!automatic)toast('Resolve local storage before syncing.');return;}
  if(!navigator.onLine){if(!automatic)toast('Offline. Notes will sync after your connection returns.');return;}
  if(!connected||!driveConfig.folder||!hasDriveAccess()){
    if(workspaceReady)lockWorkspace();
    if(connected&&!hasDriveAccess()){connected=false;clearPhotos();$('#current-user').textContent='';renderKeepingDraft();fillSettings();$('#connection').textContent='Reconnect Google Drive to resume sync';}
    if(!automatic){if(!$('#drive-dialog').open)$('#drive-dialog').showModal();readyGoogle();}
    return;
  }
  const epoch=sessionEpoch;syncing=true;fillSettings();$('#drive-status').textContent='Syncing with Google Drive…';
  try{
    const storage=await ensureWorkspaceFolder(driveConfig.folder);if(epoch!==sessionEpoch)return;
    if(driveConfig.folder!==storage.id||driveConfig.folderName!==storage.name){driveConfig.folder=storage.id;driveConfig.folderName=storage.name;rememberSettings();appendActivity('directory.selected','directory',storage.id,'Infirmary-BHR storage folder ready');}
    const snapshot=structuredClone(data),merged=await syncDirectory(storage.id,snapshot);
    if(epoch!==sessionEpoch)return;
    // Preserve notes added during the request; the next cycle uploads them.
    const next=mergeDirectories(data,merged),changed=JSON.stringify(next)!==JSON.stringify(data);
    if(!save(next,true))throw new Error('Drive synced, but local storage failed. Export records before closing.');
    if(loggingOut&&JSON.stringify(next)!==JSON.stringify(merged))throw new Error('Records changed during final sync. Retry logout to send the latest changes.');
    if(connected&&hasDriveAccess())unlockWorkspace();
    if(changed){const input=$('.note-form input'),draft=input?.value,focused=document.activeElement===input;selected=selected||[...data.people].sort(compareDirectoryPeople)[0]?.id;render();if(draft&&$('.note-form input'))$('.note-form input').value=draft;if(focused)$('.note-form input')?.focus();}
    $('#connection').textContent='Last synced '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('#drive-status').textContent='Synced. Automatic sync checks every 10 seconds while connected.';
    refreshFiles();return true;
  }catch(error){if(epoch!==sessionEpoch)return;$('#drive-status').textContent=error.message;$('#connection').textContent='Sync failed · local notes retained';if(!automatic)toast(error.message);}
  finally{syncing=false;fillSettings();}
}
$('#sync').onclick=()=>runSync();
$('#manual-sync').onclick=()=>runSync();
setInterval(()=>{if(workspaceReady&&!hasDriveAccess())lockWorkspace();if(!document.hidden)runSync(true);},10000);
// Refresh derived ages after midnight without replacing an in-progress note.
setInterval(()=>{const p=data.people.find(p=>p.id===selected),field=$('.age');if(field&&p){const age=personAge(p);field.textContent=`${p.deceased?'Age at death':'Age'}: ${age===null?'— (complete dates needed)':age+' years'}`;}},60000);
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
window.addEventListener('storage',event=>{
  if((event.key===KEY&&event.newValue===null)||event.key===LOGOUT_KEY||event.key===null){clearProtectedWorkspace(false);return;}
  if(event.key===KEY){toast('Records changed in another tab. Reload this tab before editing.');storageFailed=true;$('.workspace').inert=true;}
});
function connection(){if(!navigator.onLine)$('#connection').textContent='Offline · local notes available';else if($('#connection').textContent.startsWith('Offline'))$('#connection').textContent='Local workspace';}window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Offline caching unavailable. Use HTTPS or localhost.'));


function openUpload(id){
  if(uploading){$('#upload-dialog').showModal();return;}
  const person=data.people.find(p=>p.id===id);
  if(!person?.driveFolders?.length){toast('Attach a Google Drive folder to this person first.');return;}
  if(!connected||!hasDriveAccess()){toast('Connect Google Drive before uploading a file.');if(!$('#drive-dialog').open)$('#drive-dialog').showModal();readyGoogle();return;}
  uploadPersonId=id;$('#upload-form').reset();$('#upload-status').textContent='';$('#upload-person-name').textContent='For '+personName(person);
  const select=$('#upload-folder');select.replaceChildren();
  if(person.driveFolders.length>1){const placeholder=element('option','Choose this person’s destination folder…');placeholder.value='';select.append(placeholder);}
  for(const folder of person.driveFolders){const option=element('option',folder.name||'Drive folder');option.value=folder.id;select.append(option);}
  $('#upload-dialog').showModal();
}
$('#upload-form').onsubmit=async event=>{
  event.preventDefault();if(uploading)return;
  const file=$('#upload-file').files[0],folder=$('#upload-folder').value;if(!file||!folder)return;
  const uploadEpoch=sessionEpoch;uploading=true;fillSettings();$('#upload-submit').disabled=true;$('#upload-file').disabled=true;$('#upload-folder').disabled=true;$('#upload-status').textContent='Uploading directly to Google Drive… Keep this page open.';
  const actor=getCurrentUser();
  try{const uploaded=await uploadPersonFile(folder,file);if(uploadEpoch!==sessionEpoch)return;appendActivity('file.uploaded','file',uploaded.id||'unknown-file','File uploaded to Drive folder '+folder,uploadPersonId,actor);runSync();$('#upload-status').textContent='Uploaded to Google Drive: '+file.name;$('#upload-file').value='';toast('File uploaded to Google Drive.');}
  catch(error){if(uploadEpoch===sessionEpoch)$('#upload-status').textContent=error.message;}
  finally{uploading=false;fillSettings();$('#upload-submit').disabled=false;$('#upload-file').disabled=false;$('#upload-folder').disabled=false;}
};
window.addEventListener('beforeunload',event=>{if(uploading){event.preventDefault();event.returnValue='';}});

let trashTarget;
document.addEventListener('trash-request',event=>{
  const target=event.detail,sticky=target.desktopNoteId?data.desktopNotes?.find(note=>note.id===target.desktopNoteId):null,person=data.people.find(p=>p.id===target.personId),note=target.noteId?person?.notes.find(n=>n.id===target.noteId):null;
  if(target.desktopNoteId?!sticky:!person||(target.noteId&&!note)){toast('This entry is no longer in the directory.');return;}
  if(note&&!canEditNote(note,getCurrentUser())){toast('Only the Google account that entered this note can delete it.');return;}
  trashTarget={...target};$('#trash-error').textContent='';$('#trash-entry-label').textContent=sticky?'Shared desktop note · '+new Date(sticky.createdAt).toLocaleString():note?`Note for ${personName(person)} · ${formatTime(currentNoteTime(note))}`:`Person: ${personName(person)} (including ${person.notes.length} notes)`;
  $('#trash-dialog').showModal();$('#trash-dialog [data-close]').focus();
});
$('#trash-form').onsubmit=event=>{
  event.preventDefault();try{
    const next=deleteDirectoryEntry(data,trashTarget,getCurrentUser());
    if(save(next)){
      if(!trashTarget.noteId&&editPersonId===trashTarget.personId){$('#person-form').reset();clearPhotoPreview();$('#person-dialog').close();document.querySelector('#window-dock [data-window="person-dialog"]')?.remove();}
      if(noteEditTarget?.personId===trashTarget.personId&&(!trashTarget.noteId||noteEditTarget.noteId===trashTarget.noteId)){$('#note-edit-text').value='';$('#note-dialog').close();noteEditTarget=undefined;document.querySelector('#window-dock [data-window="note-dialog"]')?.remove();}
      if(!data.people.some(p=>p.id===selected))selected=[...data.people].sort(compareDirectoryPeople)[0]?.id;clearPhotos();clearTrashSelection();render();$('#trash-dialog').close();toast('Entry permanently deleted from this directory. Drive sync will propagate the deletion.');}
  }catch(error){$('#trash-error').textContent=error.message;}
};
$('#trash-dialog').addEventListener('close',()=>{trashTarget=undefined;$('#trash-entry-label').textContent='';});

function lockWorkspace(){
  clearDemographics();historySession(false);medicationsSession(false);documentsSession(false);
  if(!hasDriveAccess()){connected=false;clearPhotos();$('#current-user').textContent='';}
  workspaceReady=false;document.body.classList.add('drive-locked');$('.desktop').inert=true;closeDesktopMenu();closeAppMenu();
  for(const dialog of document.querySelectorAll('dialog'))if(dialog.id!=='drive-dialog'&&dialog.open)dialog.close();
  $('#connection-required').hidden=false;$('#drive-dialog [data-close]').disabled=true;fillSettings();
  if(!$('#drive-dialog').open&&!choosingFolder)$('#drive-dialog').showModal();
}
function unlockWorkspace(){const opening=!workspaceReady;workspaceReady=true;document.body.classList.remove('drive-locked');$('.desktop').inert=storageFailed;$('#connection-required').hidden=true;$('#drive-dialog [data-close]').disabled=false;fillSettings();documentsSession(true);medicationsSession(true);historySession(true);if(opening)renderKeepingDraft();}
$('#drive-dialog').addEventListener('cancel',event=>{if(!workspaceReady)event.preventDefault();});
$('#drive-dialog').addEventListener('close',()=>{if(!workspaceReady&&!choosingFolder)queueMicrotask(()=>{if(!$('#drive-dialog').open&&!choosingFolder)$('#drive-dialog').showModal();});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&workspaceReady&&!hasDriveAccess()){lockWorkspace();readyGoogle();}});
let stickyOrigin={x:24,y:24};
initDesktopNotes(origin=>{if(!workspaceReady)return;stickyOrigin=origin;$('#sticky-form').reset();$('#sticky-error').textContent='';$('#sticky-dialog').showModal();$('#sticky-text').focus();},(id,position)=>{
  if(!workspaceReady)return;const next=structuredClone(data),note=next.desktopNotes?.find(note=>note.id===id);if(!note)return;
  note.x=Math.min(position.x,Math.max(0,innerWidth-260));note.y=Math.min(position.y,Math.max(0,innerHeight-$('.menubar').getBoundingClientRect().bottom-120));note.updatedAt=new Date(Math.max(Date.now(),Date.parse(note.updatedAt)+1)).toISOString();if(save(next))renderDesktopNotes(data.desktopNotes);
});
$('#sticky-form').onsubmit=event=>{
  event.preventDefault();const text=$('#sticky-text').value.trim();if(!text)return;const user=getCurrentUser(),now=new Date().toISOString(),next=structuredClone(data);next.desktopNotes??=[];
  next.desktopNotes.push({id:crypto.randomUUID(),text,createdAt:now,updatedAt:now,authorName:user?.name||'Connected staff',...(user?{authorId:user.id}:{}),x:stickyOrigin.x,y:stickyOrigin.y});
  if(save(next)){$('#sticky-dialog').close();renderDesktopNotes(data.desktopNotes);runSync();}
};
initBackground();decoratePrintButtons();
initDocuments({closeDesktopMenu,person:id=>data.people.find(person=>person.id===id),people:()=>[...data.people].sort(compareDirectoryPeople).map(person=>({id:person.id,name:personName(person),deceased:Boolean(person.deceased)})),activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('documents',value),chartChanged:()=>renderKeepingDraft()});
initDemographics({person:id=>workspaceReady?data.people.find(person=>person.id===id):null,personName,activity:(...args)=>{appendActivity(...args);runSync();}});
initHistory({people:()=>data.people,personName,activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('history',value),notice:toast,link:(id,link)=>{const next=structuredClone(data),person=next.people.find(person=>person.id===id);if(!person)throw new Error('This person was removed.');person.historySheet=link;person.updatedAt=new Date(Math.max(Date.now(),Date.parse(person.updatedAt)+1)).toISOString();if(!save(next))throw new Error('The history sheet exists, but its directory link could not be saved. Retry after resolving storage.');renderKeepingDraft();runSync();}});
initMedications({people:()=>data.people,personName,activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('medications',value),notice:toast,link:(id,link)=>{const next=structuredClone(data),person=next.people.find(person=>person.id===id);if(!person)throw new Error('This person was removed.');person.medicationSheet=link;person.updatedAt=new Date(Math.max(Date.now(),Date.parse(person.updatedAt)+1)).toISOString();if(!save(next))throw new Error('The medication sheet exists, but its directory link could not be saved. Retry after resolving storage.');renderKeepingDraft();runSync();}});
lockWorkspace();readyGoogle();

function appendActivity(action,type,id,summary,personId,user=getCurrentUser()){
  if(sessionCleared)return;
  const next={...data,eventLog:mergeEventLogs(data.eventLog,[createEvent(user,action,type,id,summary,personId)])};
  if(!save(next,true))toast('The action completed, but its event log could not be saved. Keep this page open and resolve storage.');
}
function refreshEventLog(){
  const pre=$('#event-log-text');if(!pre)return;const scroll=pre.scrollTop;
  pre.textContent=(mergeEventLogs(data.eventLog).map(event=>`${new Date(event.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'})} | ${event.actorName} | ${event.summary} | ${event.entityType}: ${event.entityId}${event.personId?' | person: '+event.personId:''}`).join('\n\n'))||'No events recorded yet.';pre.scrollTop=scroll;
}
function openEventLog(){document.querySelector('#window-dock [data-window="event-log-dialog"]')?.remove();if(!workspaceReady||!hasDriveAccess()){lockWorkspace();return;}refreshEventLog();if(!$('#event-log-dialog').open)$('#event-log-dialog').showModal();}
$('#event-log-icon').ondblclick=openEventLog;
$('#event-log-icon').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openEventLog();}};
