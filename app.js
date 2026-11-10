import {initImmunizations,immunizationsSession,openImmunizations} from './immunizations.js?v=0.28.3';
import {initOrganization,setOrganization,clearOrganization} from './organization.js?v=0.28.0';
import {loadSyncInterval,validSyncInterval,syncDescription,SYNC_PREFERENCE_KEY} from './sync-preferences.js?v=0.28.0';
import {initRefillAlerts,refillAlertsSession,refillAlertsDirectoryChanged,refreshRefillAlerts} from './refill-alerts.js?v=0.28.0';
import {mergeAlertEvents,alertSettings} from './refill-alerts-model.js?v=0.28.0';
import {initAccountMenu,updateAccountMenu} from './account-menu.js?v=0.28.0';
import {calendarSymbol} from './calendar-symbols.js?v=0.28.0';
import {clearDesktopSelection} from './desktop-selection.js?v=0.28.0';
import {trashDesktopBatch} from './documents.js?v=0.28.0';
import {hasStaffProfile,loadStaffProfile,saveStaffProfile,useSharedWorkspace} from './drive.js?v=0.28.0';
import {initVitals,vitalsSession,openVitals,chartVitalSummary} from './vitals.js?v=0.28.0';
import {changeFolderLink} from './model.js?v=0.28.0';
import {openMainWindow,closeMainWindow,showWindow,updateWindowTitle} from './windows.js?v=0.28.5';
import {initCalendar,calendarSession} from './calendar.js?v=0.28.0';
import {initBackground} from './background.js?v=0.28.0';
import {initHistory,historySession,openHistory} from './history.js?v=0.28.0';
import {smallIcon,decoratePrintButtons} from './icons-ui.js?v=0.28.0';
import {printDocument} from './printing.js?v=0.28.0';
import {initDemographics,fillAdditional,readAdditional,openDemographics,clearDemographics} from './demographics.js?v=0.28.0';
import {initMedications,medicationsSession,openMedications} from './medications.js?v=0.28.0';
import {initDocuments,documentsSession,refreshFiles,chartDocuments} from './documents.js?v=0.28.0';
import {updateSessionPresence} from './presence.js?v=0.28.0';
import {closeAppMenu} from './app-menu.js?v=0.28.0';
import {recordChanges,createEvent,mergeEventLogs} from './events.js?v=0.28.0';
import {initDesktopNotes,renderDesktopNotes,closeDesktopMenu,prepareStickyEditor,stickyDrawing,clearStickyState} from './sticky.js?v=0.28.5';
import {makeTrashable,clearTrashSelection,finishEntryDrag} from './trash.js?v=0.28.0';
import {validatePhoto} from './photos.js?v=0.28.0';
import './windows.js?v=0.28.5';
import {emptyDirectory,validateDirectory,personName,birthDateError,parseFolder,mergeDirectories,personAge,deathDateError,currentNoteText,currentNoteTime,canEditNote,editNote,deleteDirectoryEntry,compareDirectoryPeople,deathDateParts,formatDeathDate} from './model.js?v=0.28.0';
import {prepareGoogle,authorize,syncDirectory,ensureWorkspaceFolder,getWorkspaceFolder,disconnect,preparePicker,pickFolder,hasDriveAccess,uploadPersonFile,getCurrentUser,loadCurrentUser,readPersonPhoto} from './drive.js?v=0.28.0';
const $=s=>document.querySelector(s),KEY='infirmary.directory.v1',LOGOUT_KEY='infirmary.logout';
let bulkTargets=[],bulkBusy=false;
let data=emptyDirectory(),selected,storageFailed=false,editPersonId=null,personSaveBusy=false,photoPreviewUrl,noteEditTarget,workspaceReady=false,choosingFolder=false,deceasedCollapsed=false,sessionEpoch=0,sessionCleared=false;
try{deceasedCollapsed=localStorage.getItem('infirmary.deceasedCollapsed')==='true';}catch{}
const photoUrls=new Map();let photoGeneration=0,photoViewerRequest=0;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6000);}
try{const stored=localStorage.getItem(KEY);if(stored)data=validateDirectory(JSON.parse(stored));}catch{storageFailed=true;toast('Stored data could not be read. Existing storage has been preserved; reload after resolving the problem.');}
function save(next,fromSync=false){if(sessionCleared)return false;if(!fromSync&&(!workspaceReady||!hasDriveAccess())){if(workspaceReady)lockWorkspace();toast('Connect Google Drive and sync the directory first.');return false;}if(storageFailed){toast('Storage is unavailable. Existing data is protected.');return false;}try{if(!fromSync)next=recordChanges(data,next,getCurrentUser());const {organization,...cachedDirectory}=next;localStorage.setItem(KEY,JSON.stringify(cachedDirectory));data=next;if(workspaceReady)setOrganization(next.organization);refillAlertsDirectoryChanged();refreshEventLog();$('#storage-status').textContent='Saved on this device';return true;}catch{toast('Could not save: device storage is unavailable or full. Export your existing records.');return false;}}
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
    const button=element('button',undefined,'person'+(selected===p.id?' selected':''));button.type='button';button.dataset.personId=p.id;button.setAttribute('aria-pressed',String(selected===p.id));button.append(element('strong',personName(p)));const fullName=[p.firstName,p.middleName,p.lastName].filter(Boolean).join(' ');if(fullName && fullName!==personName(p))button.append(element('span',fullName));button.onclick=()=>selectPerson(p.id);makeTrashable(button,{personId:p.id});const row=element('div',undefined,'person-row'+(p.deceased?' deceased-row':'')),edit=element('button','✎','record-pencil');edit.type='button';edit.title='Edit record';edit.setAttribute('aria-label','Edit record for '+personName(p));edit.onclick=()=>openPerson(p.id);row.append(button,edit);$('#people').append(row);
  }
  if(!people.length)$('#people').append(element('p',query?'No matching people.':'Your directory is empty.','empty'));
  $('#people-count').textContent=`${data.people.length} ${data.people.length===1?'person':'people'} in directory`;
  renderDetail();
}
function selectPerson(id){
  if(selected===id||!data.people.some(person=>person.id===id))return;
  selected=id;clearTrashSelection();
  for(const button of document.querySelectorAll('#people .person')){const chosen=button.dataset.personId===id;button.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',String(chosen));}
  renderDetail();
}
function renderDetail(){
  const panel=$('#detail');panel.replaceChildren();const person=data.people.find(p=>p.id===selected);
  if(!person){const blank=element('div',undefined,'empty');blank.append(element('div','▤','empty-icon'),element('h2','A place for everyday care'),element('p','Add a person to begin, or connect Google Drive to pull an existing directory.'));panel.append(blank);return;}
  const header=element('div',undefined,'person-header'),title=element('div'),avatar=makeAvatar(person);
  title.append(element('div','PERSON RECORD','eyebrow'),element('h2',personName(person)));
  const editRecord=element('button','✎','record-pencil');editRecord.type='button';editRecord.title='Edit record';editRecord.setAttribute('aria-label','Edit this record');editRecord.onclick=()=>openPerson(person.id);
  const avatarGroup=element('div',undefined,'avatar-group');avatarGroup.append(avatar);if(person.deceased)avatarGroup.append(makeCrucifix());
  const recordActions=element('div',undefined,'record-actions'),upload=element('button','Upload file…');upload.type='button';upload.onclick=()=>openUpload(person.id);recordActions.append(editRecord,upload);header.append(avatarGroup,title,recordActions);panel.append(header);
  const navigation=element('nav',undefined,'chart-navigation');navigation.setAttribute('aria-label','Chart sections');
  for(const section of ['Demographics','Vital Signs','Medications','Medical History','Immunizations']){const item=element('button',section);item.type='button';const icon=section==='Vital Signs'?smallIcon('stethoscope'):calendarSymbol(document,{'Demographics':'record','Medications':'pills','Medical History':'dna','Immunizations':'syringe'}[section]);icon.classList.add('small-icon');if(section!=='Vital Signs')icon.classList.add('chart-symbol');item.prepend(icon);item.setAttribute('aria-haspopup','dialog');item.onclick=()=>{if(section==='Vital Signs'){openVitals(person.id);return;}if(section==='Demographics'){openDemographics(person.id);return;}if(section==='Medications'){openMedications(person.id);return;}if(section==='Immunizations'){openImmunizations(person.id);return;}if(section==='Medical History'){openHistory(person.id);return;}$('#chart-section-title').textContent=section;$('#chart-section-message').textContent=section+' is not available yet.';$('#chart-section-dialog').showModal();};navigation.append(item);}panel.append(navigation);
  const overview=element('div',undefined,'person-overview'),facts=element('div',undefined,'person-facts'),dimensions=element('aside',undefined,'person-vitals-summary');dimensions.setAttribute('aria-label','Latest height and weight');overview.append(facts,dimensions);panel.append(overview);chartVitalSummary(dimensions,person.id);
  const legalName=[person.firstName,person.middleName,person.lastName].filter(Boolean).join(' ');
  if(legalName && legalName!==personName(person))facts.append(element('p',legalName,'muted legal-name'));
  if(person.birthDate && Object.values(person.birthDate).some(Boolean)){const b=person.birthDate;facts.append(element('p',`Date of birth: ${b.month||'—'} / ${b.day||'—'} / ${b.year||'—'}`,'muted'));}
  const age=personAge(person);facts.append(element('p',`${person.deceased?'Age at death':'Age'}: ${age===null?'— (complete dates needed)':age+' years'}`,'muted age'));
  if(person.noKnownAllergies)facts.append(element('p','No known allergies','allergies'));
  else if(person.allergies?.trim())facts.append(element('p','Allergies: '+person.allergies.trim(),'allergies'));
  if(person.deceased)facts.append(element('p',`Date of death: ${formatDeathDate(person.deathDate)}`,'death-status'));
  const folderSection=element('section',undefined,'person-folders'),folderHeading=element('div',undefined,'notes-heading'),attach=element('button','Attach folder…');attach.type='button';attach.onclick=()=>openPersonFolder(person.id);folderHeading.append(element('h3','Drive folders'),attach);folderSection.append(folderHeading);
  for(const folder of person.driveFolders||[]){const row=element('div',undefined,'folder-entry'),detach=element('button','×','detach-folder');detach.type='button';detach.title='Detach folder';detach.setAttribute('aria-label','Detach folder '+(folder.name||'Drive folder'));detach.onclick=()=>openDetachFolder(person.id,folder.id);const link=element('a',folder.name||'Drive folder','folder-link');link.href=`https://drive.google.com/drive/folders/${encodeURIComponent(folder.id)}`;link.target='_blank';link.rel='noopener noreferrer';row.append(detach,link);folderSection.append(row);}
  if(!person.driveFolders?.length)folderSection.append(element('p','No folders attached.','muted'));
  const documents=element('section',undefined,'clinical-documents');panel.append(documents);chartDocuments(documents,person.id);
  if(person.info)panel.append(element('p',person.info,'info'));
  const heading=element('div',undefined,'notes-heading quick-notes-heading');heading.append(element('h3','Clinical quick notes'),element('span',`${person.notes.length} entries`,'muted'));panel.append(heading);
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
function makeAvatar(person){const avatar=element(person.photo?'button':'div',initials(person),'avatar');if(person.photo){avatar.type='button';avatar.classList.add('photo-button');avatar.title='View full profile photo';avatar.setAttribute('aria-label','View full profile photo of '+personName(person));avatar.setAttribute('aria-haspopup','dialog');avatar.onclick=()=>openPhotoViewer(person);displayPhoto(avatar,person);}return avatar;}
async function displayPhoto(avatar,person){
  const fileId=person.photo.fileId,generation=photoGeneration;avatar.dataset.photoFile=fileId;if(!hasDriveAccess()){avatar.title='Connect Google Drive to view profile photo';return;}
  try{const url=await profilePhotoUrl(fileId);if(!avatar.isConnected||!hasDriveAccess()||generation!==photoGeneration||avatar.dataset.photoFile!==fileId)return;const img=element('img');img.alt='Profile photo of '+personName(person);img.src=url;img.onerror=()=>{avatar.textContent=initials(person);avatar.title='Photo unavailable';};avatar.replaceChildren(img);
  }catch{photoUrls.delete(fileId);avatar.title='Photo unavailable; initials shown';}
}
function profilePhotoUrl(fileId){let pending=photoUrls.get(fileId);if(!pending){pending=readPersonPhoto(fileId).then(blob=>URL.createObjectURL(blob));photoUrls.set(fileId,pending);}return pending;}
function clearPhotoViewer(){photoViewerRequest++;const dialog=$('#photo-viewer-dialog');if(dialog.open)dialog.close();$('#photo-viewer-image').replaceChildren();$('#photo-viewer-status').textContent='';$('#photo-viewer-title').textContent='Profile photo';}
async function openPhotoViewer(person){
 if(!workspaceReady||!hasDriveAccess()||!person.photo)return;const request=++photoViewerRequest,generation=photoGeneration,dialog=$('#photo-viewer-dialog');$('#photo-viewer-title').textContent='Profile photo — '+personName(person);$('#photo-viewer-image').replaceChildren();$('#photo-viewer-status').textContent='Loading photo…';if(!dialog.open)dialog.showModal();
 try{const url=await profilePhotoUrl(person.photo.fileId);if(request!==photoViewerRequest||generation!==photoGeneration||!dialog.open||!workspaceReady||!hasDriveAccess())return;
  const image=element('img');image.alt='Full profile photo of '+personName(person);image.onload=()=>{if(request===photoViewerRequest)$('#photo-viewer-status').textContent='';};image.onerror=()=>{if(request===photoViewerRequest){image.remove();$('#photo-viewer-status').textContent='This image could not be displayed.';}};image.src=url;$('#photo-viewer-image').replaceChildren(image);
 }catch(error){if(request!==photoViewerRequest||!dialog.open)return;photoUrls.delete(person.photo.fileId);$('#photo-viewer-status').textContent=[403,404].includes(error.status)?'Photo unavailable. Your Google account may need access to its Google Drive folder.':'Photo unavailable. '+error.message;}
}
$('#photo-viewer-dialog').addEventListener('close',()=>{if(!$('#photo-viewer-dialog').open)clearPhotoViewer();});
function clearPhotos(){clearPhotoViewer();photoGeneration++;for(const pending of photoUrls.values())pending.then(url=>URL.revokeObjectURL(url)).catch(()=>{});photoUrls.clear();}
function renderKeepingDraft(){const input=$('.note-form input'),draft=input?.value,focused=document.activeElement===input;render();if($('.note-form input')&&draft)$('.note-form input').value=draft;if(focused)$('.note-form input')?.focus();}
function openNoteEditor(personId,noteId){const note=data.people.find(p=>p.id===personId)?.notes.find(n=>n.id===noteId);if(!note||!canEditNote(note,getCurrentUser())){toast('Connect the original author’s Google account to edit this note.');return;}noteEditTarget={personId,noteId,baseline:JSON.stringify(note)};$('#note-edit-text').value=currentNoteText(note);$('#note-edit-time').value=localNoteDate(currentNoteTime(note));$('#note-edit-error').textContent='';$('#note-dialog').showModal();$('#note-edit-text').focus();}
$('#note-edit-form').onsubmit=event=>{event.preventDefault();try{if(!noteEditTarget)throw new Error('Only the Google account that entered this note can edit it. Reopen the note first.');const {personId,noteId,baseline}=noteEditTarget,next=structuredClone(data),person=next.people.find(p=>p.id===personId),index=person.notes.findIndex(n=>n.id===noteId),note=person.notes[index];if(JSON.stringify(note)!==baseline)throw new Error('This note changed. Reopen it before editing.');person.notes[index]=editNote(note,getCurrentUser(),$('#note-edit-text').value,new Date().toISOString(),new Date($('#note-edit-time').value).toISOString());person.updatedAt=new Date().toISOString();if(save(next)){$('#note-dialog').close();renderKeepingDraft();}}catch(error){$('#note-edit-error').textContent=error.message;}};
function localNoteDate(iso){const date=new Date(iso);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);}
$('#note-trash').onclick=()=>{if(noteEditTarget)document.dispatchEvent(new CustomEvent('trash-request',{detail:{personId:noteEditTarget.personId,noteId:noteEditTarget.noteId}}));};
$('#note-print').onclick=async()=>{if(!noteEditTarget||!workspaceReady)return;const person=data.people.find(p=>p.id===noteEditTarget.personId),note=person?.notes.find(n=>n.id===noteEditTarget.noteId);if(!note||!canEditNote(note,getCurrentUser()))return;const stamp=sessionEpoch;$('#note-print').disabled=true;try{const date=new Date($('#note-edit-time').value);if(!Number.isFinite(date.getTime()))throw new Error('Enter a valid note date and time.');const text=$('#note-edit-text').value;await printDocument({title:'Clinical quick note',person:structuredClone(person),sections:[{lines:[text]}],subtitle:'Note date: '+date.toLocaleString()+' · Entered by '+note.authorName+(text!==currentNoteText(note)||date.getTime()!==Date.parse(currentNoteTime(note))?' · Unsaved changes':'')});if(stamp===sessionEpoch)appendActivity('note.print_requested','note',note.id,'Quick note print dialog requested',person.id);}catch(error){if(stamp===sessionEpoch)$('#note-edit-error').textContent=error.message;}finally{$('#note-print').disabled=false;}};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>document.getElementById(button.dataset.close).close();
$('#export').onclick=()=>{if(!workspaceReady||!hasDriveAccess()){lockWorkspace();return;}const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download='people_directory.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let driveConfig={...window.INFIRMARY_CONFIG},googleReady=false,googleLoading=false,connecting=false,connected=false,pickerReady=false,folderTarget,syncing=false,syncAgain=false,loggingOut=false,syncPromise=null,uploading=false,uploadPersonId,fileBusy=false;
let autoSyncSeconds=10,autoSyncTimer;try{autoSyncSeconds=loadSyncInterval(localStorage);}catch{}
const externalOperations=new Set();
function externalBusy(name,value){if(value)externalOperations.add(name);else externalOperations.delete(name);fileBusy=externalOperations.size>0;fillSettings();}
try{
  const remembered=JSON.parse(localStorage.getItem('infirmary.drive')||'{}');
  driveConfig={...remembered,...Object.fromEntries(Object.entries(driveConfig).filter(([,value])=>value))};
}catch{}
let dataWorkspace=driveConfig.folder;
function fillSettings(){
  $('#sync-status').hidden=!syncing;$('#auto-sync-status').textContent=syncDescription(autoSyncSeconds);
  const driveActive=connected&&hasDriveAccess(),driveReady=driveActive&&workspaceReady;$('#drive-dialog').classList.toggle('drive-connected',driveReady);$('#drive-connection-badge').hidden=!driveActive;const connectionLabel=driveReady?'● Connected to Google Drive':'Google signed in · finish directory sync';if($('#drive-connection-badge').textContent!==connectionLabel)$('#drive-connection-badge').textContent=connectionLabel;
  $('#sync-folder-name').textContent=driveConfig.folder?(driveConfig.folderName||'Directory folder selected'):'No directory folder selected';
  $('#google-connect').disabled=connecting||connected;
  $('#google-connect').setAttribute('aria-busy',String(connecting));
  $('#choose-sync-folder').disabled=!connected||!pickerReady;
  $('#open-shared-workspace').disabled=!connected||syncing;
  $('#edit-staff-profile').hidden=!workspaceReady;
  $('#use-drive-root').disabled=!connected;
  $('#sync').disabled=!connected||!driveConfig.folder||syncing;
  $('#manual-sync').disabled=syncing||!workspaceReady;
  $('#preferences-open').disabled=!workspaceReady;$('#export').disabled=!workspaceReady;$('#event-log-icon').disabled=!workspaceReady;
  $('#logout-power').disabled=!workspaceReady||loggingOut||personSaveBusy||uploading||fileBusy;
  updateAccountMenu(workspaceReady&&hasDriveAccess()?getCurrentUser():null);
  updateSessionPresence(workspaceReady&&hasDriveAccess()?(getCurrentUser()||{id:'current-session',name:'Connected Google account'}):null);
  $('#manual-sync').setAttribute('aria-busy',String(syncing));
  $('#choose-sync-folder').disabled ||= syncing||workspaceReady;
  $('#open-shared-workspace').disabled ||= workspaceReady;
  $('#shared-workspace-link').disabled=syncing||workspaceReady;
  $('#use-drive-root').disabled ||= syncing||workspaceReady;
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
  try{await authorize(driveConfig.clientId);if(authEpoch!==sessionEpoch){disconnect();return;}connected=true;sessionCleared=false;clearPhotos();const user=await loadCurrentUser();$('#current-user').textContent='Google account: '+(user.email||user.googleName);if(authEpoch!==sessionEpoch){$('#current-user').textContent='';return;}appendActivity('drive.connected','directory',driveConfig.folder||'unselected','Google Drive connection established');renderKeepingDraft();$('#drive-status').textContent='Signed in. Open the shared Infirmary-BHR folder supplied by your administrator.';if(driveConfig.folder&&!workspaceReady)await runSync();}
  catch(error){if(authEpoch!==sessionEpoch)return;disconnect();connected=false;$('#drive-status').textContent=error.message;}
  finally{connecting=false;fillSettings();}
};
async function chooseFolder(dialog){
  // Native Google Picker must appear above the app, outside a modal's top layer.
  const pickerEpoch=sessionEpoch;choosingFolder=true;dialog.close();try{const folder=await pickFolder(driveConfig);return pickerEpoch===sessionEpoch?folder:null;}finally{choosingFolder=false;if(pickerEpoch===sessionEpoch&&!dialog.open)dialog.showModal();}
}
$('#choose-sync-folder').onclick=async()=>{try{await authorize(driveConfig.clientId);const folder=await chooseFolder($('#drive-dialog'));if(folder){driveConfig.folder=folder.id;driveConfig.folderName=folder.name;driveConfig.existingWorkspace=true;rememberSettings();appendActivity('directory.selected','directory',folder.id,'Directory storage folder selected');fillSettings();$('#drive-status').textContent='Directory folder selected. Choose Sync directory to merge your records.';if(!workspaceReady)await runSync();}}catch(error){$('#drive-status').textContent=error.message;}};
$('#use-drive-root').onclick=()=>{if(workspaceReady)return;driveConfig.folder='root';driveConfig.existingWorkspace=false;driveConfig.folderName='Infirmary-BHR';rememberSettings();appendActivity('directory.selected','directory','root','Infirmary-BHR storage selected');fillSettings();$('#drive-status').textContent='Sync will create or reuse Infirmary-BHR and organize existing BHR files there.';if(!workspaceReady)runSync();};
$('#open-shared-workspace').onclick=async()=>{if(workspaceReady)return;try{const id=parseFolder($('#shared-workspace-link').value);if(id==='root')throw new Error('Use the shared folder link, not My Drive.');driveConfig.folder=id;driveConfig.existingWorkspace=true;driveConfig.folderName='Shared Infirmary-BHR';rememberSettings();await runSync();}catch(error){$('#drive-status').textContent=error.message;}};
function showStaffProfile(){const user=getCurrentUser();$('#staff-display-name').value=user?.name||'';$('#staff-profile-panel').hidden=false;$('#drive-status').textContent='Choose the name shown on your BHR entries, then continue.';$('#staff-display-name').focus();}
$('#edit-staff-profile').onclick=showStaffProfile;
initAccountMenu(()=>{if(!workspaceReady||!hasDriveAccess())return;if(!$('#drive-dialog').open)$('#drive-dialog').showModal();fillSettings();showStaffProfile();});
$('#save-staff-profile').onclick=async()=>{const epoch=sessionEpoch;$('#save-staff-profile').disabled=true;try{await saveStaffProfile($('#staff-display-name').value);if(epoch!==sessionEpoch)return;$('#staff-profile-panel').hidden=true;$('#current-user').textContent='Google account: '+(getCurrentUser().email||getCurrentUser().googleName)+' · BHR: '+getCurrentUser().name;await runSync();}catch(error){if(epoch===sessionEpoch)$('#drive-status').textContent=error.message;}finally{$('#save-staff-profile').disabled=false;}};
function clearProtectedWorkspace(removeStorage=true){
  if(removeStorage){
    // Remove only BHR data, preserving unrelated origin storage/preferences.
    // Do this before ending the session so a storage failure is retryable.
    localStorage.removeItem('infirmary.drive');
    localStorage.removeItem(KEY);
    if(localStorage.getItem(KEY)!==null)throw new Error('Browser records could not be cleared.');
    try{localStorage.setItem(LOGOUT_KEY,crypto.randomUUID());}catch{} // Removal itself also notifies other tabs.
  }
  $('#staff-profile-panel').hidden=true;$('#shared-workspace-link').value='';$('#staff-display-name').value='';sessionEpoch++;sessionCleared=true;syncAgain=false;choosingFolder=false;disconnect();connected=false;
  clearPhotos();clearPhotoPreview();clearTrashSelection();finishEntryDrag();clearStickyState();stickyEditId=null;stickyBaseline=null;
  data=emptyDirectory();dataWorkspace=undefined;selected=undefined;editPersonId=null;recordBaseline=undefined;noteEditTarget=undefined;folderTarget=undefined;uploadPersonId=undefined;trashTarget=undefined;
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
  $('#staff-profile-panel').hidden=true;$('#staff-display-name').value='';sessionEpoch++;syncAgain=false;disconnect();connected=false;clearPhotos();clearPhotoPreview();
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
  if(automatic&&!workspaceReady)return false;
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
    if(!getCurrentUser())throw new Error('Sign in again to identify your Google account.');
    const storage=await (driveConfig.folder!=='root'?useSharedWorkspace(driveConfig.folder):ensureWorkspaceFolder(driveConfig.folder));if(epoch!==sessionEpoch)return;
    if(driveConfig.folder!==storage.id||driveConfig.folderName!==storage.name){driveConfig.folder=storage.id;driveConfig.folderName=storage.name;rememberSettings();appendActivity('directory.selected','directory',storage.id,'Infirmary-BHR storage folder ready');}
    if(dataWorkspace&&dataWorkspace!=='root'&&dataWorkspace!==storage.id&&(data.people.length||data.desktopNotes?.length))throw new Error('This device has records from another workspace. Reconnect the original folder and log out before choosing a different workspace.');
    dataWorkspace=storage.id;
    if(!hasStaffProfile()){const profile=await loadStaffProfile();if(epoch!==sessionEpoch)return;if(!profile){showStaffProfile();return false;}$('#current-user').textContent='Google account: '+(profile.email||profile.googleName)+' · BHR: '+profile.name;$('#staff-profile-panel').hidden=true;}
    const snapshot=structuredClone(data),merged=await syncDirectory(storage.id,snapshot);
    if(epoch!==sessionEpoch)return;
    // Preserve notes added during the request; the next cycle uploads them.
    const next=mergeDirectories(data,merged),changed=JSON.stringify(next)!==JSON.stringify(data);
    if(!save(next,true))throw new Error('Drive synced, but local storage failed. Export records before closing.');
    if(loggingOut&&JSON.stringify(next)!==JSON.stringify(merged))throw new Error('Records changed during final sync. Retry logout to send the latest changes.');
    if(connected&&hasDriveAccess())unlockWorkspace();
    if(changed){const input=$('.note-form input'),draft=input?.value,focused=document.activeElement===input;selected=selected||[...data.people].sort(compareDirectoryPeople)[0]?.id;render();if(draft&&$('.note-form input'))$('.note-form input').value=draft;if(focused)$('.note-form input')?.focus();}
    $('#connection').textContent='Last synced '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('#drive-status').textContent='Synced. '+syncDescription(autoSyncSeconds)+'.';
    refreshFiles();return true;
  }catch(error){if(epoch!==sessionEpoch)return;$('#drive-status').textContent=error.message;$('#connection').textContent='Sync failed · local notes retained';if(!automatic)toast(error.message);}
  finally{syncing=false;fillSettings();}
}
$('#sync').onclick=()=>runSync();
$('#manual-sync').onclick=()=>runSync();
function scheduleAutoSync(){clearInterval(autoSyncTimer);if(autoSyncSeconds)autoSyncTimer=setInterval(()=>{if(workspaceReady&&!document.hidden)runSync(true);},autoSyncSeconds*1000);}
function saveSyncInterval(seconds){validSyncInterval(seconds);localStorage.setItem(SYNC_PREFERENCE_KEY,String(seconds));autoSyncSeconds=seconds;scheduleAutoSync();fillSettings();}
scheduleAutoSync();
// Access expiry must still lock records when periodic sync is disabled.
setInterval(()=>{if(workspaceReady&&!hasDriveAccess())lockWorkspace();},1000);
// Refresh derived ages after midnight without replacing an in-progress note.
setInterval(()=>{const p=data.people.find(p=>p.id===selected),field=$('.age');if(field&&p){const age=personAge(p);field.textContent=`${p.deceased?'Age at death':'Age'}: ${age===null?'— (complete dates needed)':age+' years'}`;}},60000);
let detachFolderTarget=null;
function openDetachFolder(personId,folderId){if(!workspaceReady)return;const person=data.people.find(p=>p.id===personId),folder=person?.driveFolders?.find(f=>f.id===folderId);if(!folder)return;detachFolderTarget={personId,folderId};$('#detach-folder-subject').textContent=personName(person)+' · '+(folder.name||'Drive folder');$('#detach-folder-error').textContent='';$('#detach-folder-dialog').showModal();}
$('#detach-folder-confirm').onclick=()=>{if(!workspaceReady||!detachFolderTarget)return;const {personId,folderId}=detachFolderTarget,next=structuredClone(data),person=next.people.find(p=>p.id===personId),folder=person?.driveFolders?.find(f=>f.id===folderId);if(!folder){$('#detach-folder-error').textContent='This folder is no longer attached to this chart.';return;}Object.assign(person,changeFolderLink(person,folder,false));if(save(next)){$('#detach-folder-dialog').close();renderKeepingDraft();runSync();}else $('#detach-folder-error').textContent='The detachment could not be saved. The folder link is unchanged.';};
$('#detach-folder-dialog').addEventListener('close',()=>{detachFolderTarget=null;$('#detach-folder-subject').textContent='';$('#detach-folder-error').textContent='';});
function openPersonFolder(id){folderTarget=id;$('#folder-form').reset();$('#folder-error').textContent='';$('#folder-dialog').showModal();}
function attachFolder(folder){
  const next=structuredClone(data),person=next.people.find(p=>p.id===folderTarget);if(!person)throw new Error('Select a person first.');
  if(person.driveFolders?.some(existing=>existing.id===folder.id))throw new Error('This folder is already attached.');
  Object.assign(person,changeFolderLink(person,folder,true));
  if(save(next)){render();$('#folder-dialog').close();return true;}return false;
}
$('#folder-form').onsubmit=event=>{event.preventDefault();try{const form=new FormData(event.target),id=parseFolder(form.get('url'));attachFolder({id,name:form.get('label').trim()||'Drive folder'});}catch(error){$('#folder-error').textContent=error.message;}};
$('#pick-person-folder').onclick=async()=>{
  if(!connected||!pickerReady){$('#folder-error').textContent='Connect Google Drive and configure its folder picker first, or paste a folder link below.';return;}
  try{await authorize(driveConfig.clientId);const folder=await chooseFolder($('#folder-dialog'));if(folder)attachFolder(folder);}catch(error){$('#folder-error').textContent=error.message;}
};
window.addEventListener('storage',event=>{
  if(event.key===SYNC_PREFERENCE_KEY){autoSyncSeconds=loadSyncInterval(localStorage);scheduleAutoSync();fillSettings();return;}
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
  $('#event-log-text').textContent='';document.querySelector('#window-dock [data-window="event-log-dialog"]')?.remove();
  clearOrganization();  refillAlertsSession(false);  clearDesktopSelection();bulkTargets=[];
  closeMainWindow();detachFolderTarget=null;  clearStickyState();stickyEditId=null;stickyBaseline=null;clearDemographics();vitalsSession(false);calendarSession(false);historySession(false);immunizationsSession(false);medicationsSession(false);documentsSession(false);
  if(!hasDriveAccess()){connected=false;clearPhotos();$('#current-user').textContent='';}
  workspaceReady=false;document.body.classList.add('drive-locked');$('.desktop').inert=true;closeDesktopMenu();closeAppMenu();
  for(const dialog of document.querySelectorAll('dialog'))if(dialog.id!=='drive-dialog'&&dialog.open)dialog.close();
  $('#connection-required').hidden=false;$('#drive-dialog [data-close]').disabled=true;fillSettings();
  if(!$('#drive-dialog').open&&!choosingFolder)$('#drive-dialog').showModal();
}
function unlockWorkspace(){const opening=!workspaceReady;workspaceReady=true;setOrganization(data.organization);document.body.classList.remove('drive-locked');$('.desktop').inert=storageFailed;$('#connection-required').hidden=true;$('#drive-dialog [data-close]').disabled=false;fillSettings();vitalsSession(true);documentsSession(true);medicationsSession(true);historySession(true);immunizationsSession(true);calendarSession(true);refillAlertsSession(true);if(opening)renderKeepingDraft();}
$('#drive-dialog').addEventListener('cancel',event=>{if(!workspaceReady)event.preventDefault();});
$('#drive-dialog').addEventListener('close',()=>{if(!workspaceReady&&!choosingFolder)queueMicrotask(()=>{if(!$('#drive-dialog').open&&!choosingFolder)$('#drive-dialog').showModal();});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&workspaceReady&&!hasDriveAccess()){lockWorkspace();readyGoogle();}});
let stickyOrigin={x:24,y:24},stickyEditId=null,stickyBaseline=null;
const stickyContent=note=>JSON.stringify([note.text,note.drawing||[]]);
function openSticky(id=null,origin={x:24,y:24}){if(!workspaceReady)return;if(document.querySelector('#window-dock [data-window="sticky-dialog"]')){showWindow($('#sticky-dialog'));$('#sticky-text').focus();return;}const note=id?data.desktopNotes?.find(n=>n.id===id):null;if(id&&!note){toast('This sticky note has been deleted.');return;}stickyEditId=id;stickyBaseline=note?stickyContent(note):null;stickyOrigin=origin;$('#sticky-form').reset();prepareStickyEditor(note);updateWindowTitle($('#sticky-dialog'));$('#sticky-error').textContent='';showWindow($('#sticky-dialog'));$('#sticky-text').focus();}
initDesktopNotes(origin=>openSticky(null,origin),(id,position)=>{
  if(!workspaceReady)return;const next=structuredClone(data),note=next.desktopNotes?.find(note=>note.id===id);if(!note)return;
  note.x=Math.min(position.x,Math.max(0,innerWidth-260));note.y=Math.min(position.y,Math.max(0,innerHeight-$('.menubar').getBoundingClientRect().bottom-120));note.updatedAt=new Date(Math.max(Date.now(),Date.parse(note.updatedAt)+1)).toISOString();if(save(next))renderDesktopNotes(data.desktopNotes);
},id=>openSticky(id));
$('#sticky-form').onsubmit=event=>{
 event.preventDefault();if(!workspaceReady)return;const text=$('#sticky-text').value.trim();let drawing;try{drawing=stickyDrawing();}catch(error){$('#sticky-error').textContent=error.message;return;}if(!text&&!drawing.length){$('#sticky-error').textContent='Enter a message or draw something.';return;}
 const user=getCurrentUser(),now=new Date().toISOString(),next=structuredClone(data);next.desktopNotes??=[];
 if(stickyEditId){const note=next.desktopNotes.find(n=>n.id===stickyEditId);if(!note){$('#sticky-error').textContent='This sticky note was deleted. Your draft has not been saved.';return;}if(stickyContent(note)!==stickyBaseline){$('#sticky-error').textContent='This sticky changed while you were editing. Copy your draft and reopen the note before saving.';return;}if(stickyContent(note)!==JSON.stringify([text,drawing])){note.text=text;note.drawing=drawing;note.editedAt=new Date(Math.max(Date.now(),Date.parse(note.updatedAt)+1)).toISOString();note.updatedAt=note.editedAt;note.editedBy=user?.name||'Connected staff';note.editedById=user?.id||'unattributed';}}
 else next.desktopNotes.push({id:crypto.randomUUID(),text,...(drawing.length?{drawing}:{}),createdAt:now,updatedAt:now,authorName:user?.name||'Connected staff',...(user?{authorId:user.id}:{}),x:stickyOrigin.x,y:stickyOrigin.y});
 if(save(next)){$('#sticky-dialog').close();stickyEditId=null;stickyBaseline=null;renderDesktopNotes(data.desktopNotes);runSync();}
};
initCalendar({people:()=>data.people.map(person=>({name:personName(person)})),activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('calendar',value)});
initBackground();decoratePrintButtons();
initDocuments({closeDesktopMenu,person:id=>data.people.find(person=>person.id===id),people:()=>[...data.people].sort(compareDirectoryPeople).map(person=>({id:person.id,name:personName(person),deceased:Boolean(person.deceased)})),activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('documents',value),chartChanged:()=>renderKeepingDraft()});
initDemographics({person:id=>workspaceReady?data.people.find(person=>person.id===id):null,personName,activity:(...args)=>{appendActivity(...args);runSync();}});
initVitals({people:()=>data.people,personName,activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('vitals',value),link:(id,link)=>{const next=structuredClone(data),p=next.people.find(p=>p.id===id);if(!p)throw new Error('This person was removed.');p.vitalsSheet=link;p.updatedAt=new Date(Math.max(Date.now(),Date.parse(p.updatedAt)+1)).toISOString();if(!save(next))throw new Error('The vital signs sheet exists, but its directory link could not be saved. Retry after resolving storage.');renderKeepingDraft();runSync();}});
initHistory({people:()=>data.people,personName,activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('history',value),notice:toast,link:(id,link)=>{const next=structuredClone(data),person=next.people.find(person=>person.id===id);if(!person)throw new Error('This person was removed.');person.historySheet=link;person.updatedAt=new Date(Math.max(Date.now(),Date.parse(person.updatedAt)+1)).toISOString();if(!save(next))throw new Error('The history sheet exists, but its directory link could not be saved. Retry after resolving storage.');renderKeepingDraft();runSync();}});
initImmunizations({people:()=>data.people,personName,activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('immunizations',value),notice:toast,link:(id,link)=>{const next=structuredClone(data),person=next.people.find(person=>person.id===id);if(!person)throw new Error('This person was removed.');person.immunizationSheet=link;person.updatedAt=new Date(Math.max(Date.now(),Date.parse(person.updatedAt)+1)).toISOString();if(!save(next))throw new Error('The immunization sheet exists, but its directory link could not be saved. Retry after resolving storage.');renderKeepingDraft();runSync();}});
initMedications({alertSettings:()=>alertSettings(data.refillAlertEvents),people:()=>data.people,personName,activity:(...args)=>{appendActivity(...args);runSync();},busy:value=>externalBusy('medications',value),notice:toast,link:(id,link)=>{const next=structuredClone(data),person=next.people.find(person=>person.id===id);if(!person)throw new Error('This person was removed.');person.medicationSheet=link;person.updatedAt=new Date(Math.max(Date.now(),Date.parse(person.updatedAt)+1)).toISOString();if(!save(next))throw new Error('The medication sheet exists, but its directory link could not be saved. Retry after resolving storage.');renderKeepingDraft();runSync();}});
initRefillAlerts({getSyncInterval:()=>autoSyncSeconds,setSyncInterval:saveSyncInterval,people:()=>data.people,directory:()=>data,personName,busy:value=>externalBusy('refill-alerts',value),sync:async()=>{if(!await runSync())throw new Error('Directory sync failed. Retry before changing shared alert state.');},commit:async entries=>{if(!workspaceReady||!hasDriveAccess())throw new Error('Reconnect first.');const next={...data,refillAlertEvents:mergeAlertEvents(data.refillAlertEvents,entries)};if(!save(next))throw new Error('Could not save alert state.');if(!await runSync())throw new Error('Saved locally; shared sync is pending. Retry directory sync.');}});
initOrganization({directory:()=>data,busy:value=>externalBusy('organization',value),sync:async()=>{if(!await runSync())throw new Error('Directory sync failed. Retry before changing organization info.');},commit:async organization=>{if(!workspaceReady)throw new Error('Reconnect first.');if(!save({...data,organization}))throw new Error('Organization info could not be saved.');if(!await runSync())throw new Error('Saved in this session; Drive sync is pending. Retry sync before signing out.');}});
lockWorkspace();readyGoogle();

function appendActivity(action,type,id,summary,personId,user=getCurrentUser()){
  if(/^(refill|medication)\.(created|updated|deleted|discontinued|list_created|scheduled_course_completed)$/.test(action))setTimeout(()=>refreshRefillAlerts(),0);
  if(sessionCleared)return;
  const next={...data,eventLog:mergeEventLogs(data.eventLog,[createEvent(user,action,type,id,summary,personId)])};
  if(!save(next,true))toast('The action completed, but its event log could not be saved. Keep this page open and resolve storage.');
}
function refreshEventLog(force=false){
  if(!force&&!$('#event-log-dialog').open&&!document.querySelector('#window-dock [data-window="event-log-dialog"]'))return;
  const pre=$('#event-log-text');if(!pre)return;const scroll=pre.scrollTop;
  pre.textContent=(mergeEventLogs(data.eventLog).map(event=>`${new Date(event.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'})} | ${event.actorName} | ${event.summary} | ${event.entityType}: ${event.entityId}${event.personId?' | person: '+event.personId:''}`).join('\n\n'))||'No events recorded yet.';pre.scrollTop=scroll;
}
function openEventLog(){document.querySelector('#window-dock [data-window="event-log-dialog"]')?.remove();if(!workspaceReady||!hasDriveAccess()){lockWorkspace();return;}refreshEventLog(true);if(!$('#event-log-dialog').open)$('#event-log-dialog').showModal();}
$('#event-log-icon').onclick=openEventLog;
function openBHR(){if(!workspaceReady||!hasDriveAccess()){lockWorkspace();return;}openMainWindow();}
$('#bhr-icon').ondblclick=openBHR;$('#bhr-icon').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openBHR();}};

document.addEventListener('desktop-trash-request',event=>{
 if(!workspaceReady||bulkBusy||fileBusy||uploading||personSaveBusy)return;bulkTargets=event.detail.map(target=>({...target}));$('#bulk-trash-list').replaceChildren(...bulkTargets.map(target=>element('li',target.name)));$('#bulk-trash-error').textContent='';$('#bulk-trash-dialog').showModal();
});
$('#bulk-trash-confirm').onclick=async()=>{
 if(!workspaceReady||bulkBusy)return;bulkBusy=true;externalBusy('bulk-trash',true);$('#bulk-trash-dialog').querySelectorAll('button').forEach(button=>button.disabled=true);const epoch=sessionEpoch;
 try{
  const files=bulkTargets.filter(target=>target.fileId),result=files.length?await trashDesktopBatch(files):{deleted:[],failed:[]};if(epoch!==sessionEpoch)return;
  let next=structuredClone(data);const stickies=bulkTargets.filter(target=>target.desktopNoteId);
  for(const target of stickies)if(next.desktopNotes?.some(note=>note.id===target.desktopNoteId))next=deleteDirectoryEntry(next,{desktopNoteId:target.desktopNoteId},getCurrentUser());
  if(stickies.length&&!save(next))result.failed.push(...stickies.map(target=>({...target,error:'Could not save deletion. Please retry.'})));
  clearDesktopSelection();renderKeepingDraft();bulkTargets=result.failed;
  if(result.failed.length){$('#bulk-trash-list').replaceChildren(...result.failed.map(target=>element('li',target.name+' — '+target.error)));$('#bulk-trash-error').textContent='These items were not deleted. Other selected items were removed.';}
  else $('#bulk-trash-dialog').close();await runSync();
 }catch(error){if(epoch===sessionEpoch)$('#bulk-trash-error').textContent=error.message;}
 finally{bulkBusy=false;externalBusy('bulk-trash',false);$('#bulk-trash-dialog').querySelectorAll('button').forEach(button=>button.disabled=false);}
};
$('#bulk-trash-dialog').addEventListener('cancel',event=>{if(bulkBusy)event.preventDefault();});
$('#bulk-trash-dialog').addEventListener('close',()=>{bulkTargets=[];$('#bulk-trash-list').replaceChildren();$('#bulk-trash-error').textContent='';});
