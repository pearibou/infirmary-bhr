import {initRefills,refillsSession,openRefills} from './refills.js?v=0.21.0';
import {printDocument,clearPrint} from './printing.js?v=0.21.0';
import {getCurrentUser,hasDriveAccess} from './drive.js?v=0.21.0';
import {readMedicationList,readAllMedicationLists,createMedicationList,addMedication,updateMedication,deleteMedication,completeScheduledCourses,resetMedicationSource} from './medications-api.js?v=0.21.0';
import {isPrnMedication,compareMedications,EDITABLE_MED_FIELDS,newMedication,reviseMedication,medicationDue,localMedicationTime} from './medications-model.js?v=0.21.0';
import {showWindow,updateWindowTitle} from './windows.js?v=0.21.0';
const $=selector=>document.querySelector(selector),dialog=$('#medications-dialog'),formDialog=$('#medication-form-dialog'),actionDialog=$('#medication-action-dialog');
let hooks,active=false,epoch=0,queue=Promise.resolve(),pending=0,currentPerson=null,context=null,tab='Active',formState=null,actionState=null,formDirty=false,refillsBusy=false;
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const people=()=>hooks.people(),knownIds=()=>people().map(person=>person.medicationSheet?.spreadsheetId).filter(Boolean);
const personById=id=>people().find(person=>person.id===id);
function alive(stamp){if(!active||stamp!==epoch||!hasDriveAccess())throw new Error('Reconnect Google Drive before using medications.');}
function run(work){
 const stamp=epoch;pending++;hooks.busy(true);controls();
 const next=queue.catch(()=>{}).then(()=>{alive(stamp);return work(stamp);});queue=next;
 return next.finally(()=>{if(stamp===epoch){pending=Math.max(0,pending-1);hooks.busy(pending>0||refillsBusy);controls();}});
}
function controls(){for(const id of ['med-add','med-refresh','med-active','med-discontinued','med-print','med-print-history','med-refills'])$('#'+id).disabled=pending>0||refillsBusy;for(const button of document.querySelectorAll('.med-entry-actions button'))button.disabled=pending>0||refillsBusy;}
function status(text){$('#med-status').textContent=text;}
function audit(action,entryId,personId,automatic=false){hooks.activity('medication.'+action,'medication',entryId,'Medication '+action.replaceAll('_',' '),personId,automatic?{id:getCurrentUser()?.id,name:`Automatic (checked by ${getCurrentUser()?.name||'connected staff'})`}:getCurrentUser());}
function failure(error,prefix=''){
 $('#med-content').replaceChildren(node('p',prefix+error.message,'med-error'));const retry=node('button','Retry');retry.type='button';retry.onclick=()=>openMedications(currentPerson);$('#med-content').append(retry);status('Medication information is unavailable until it can be retrieved.');
}
async function rememberLink(ctx,stamp){alive(stamp);const person=personById(ctx.personId);if(!person)throw new Error('This person was removed.');if(!ctx.missing&&(!person.medicationSheet||person.medicationSheet.spreadsheetId!==ctx.spreadsheetId||person.medicationSheet.sheetId!==ctx.sheetId))hooks.link(ctx.personId,{spreadsheetId:ctx.spreadsheetId,sheetId:ctx.sheetId});}
async function load(personId,stamp){
 const person=personById(personId);if(!person)throw new Error('This person is no longer in the directory.');
 let loaded=await readMedicationList(person,knownIds());alive(stamp);await rememberLink(loaded,stamp);
 let result={pending:[],completed:[]};
 if(!loaded.missing){result=await completeScheduledCourses(loaded,getCurrentUser());alive(stamp);for(const id of result.completed)audit('scheduled_course_completed',id,personId,true);if(result.completed.length)loaded=await readMedicationList(personById(personId),knownIds());}
 alive(stamp);if(currentPerson!==personId)return;loaded.retrievedAt=new Date().toISOString();context=loaded;render();status(result.pending.length?'Scheduled end passed—update pending. '+result.pending[0].error:result.completed.length?'Scheduled course completed. See Discontinued.':'');return result.pending.length===0;
}
export function initMedications(options){
 hooks=options;initRefills({person:personById,personName:options.personName,activity:options.activity,busy:value=>{refillsBusy=value;hooks.busy(value||pending>0);controls();},medications:id=>readMedicationList(personById(id),knownIds())});$('#med-refills').onclick=()=>{if(!pending&&!refillsBusy&&context&&!context.missing)openRefills(currentPerson);};$('#med-print').onclick=printMedications;$('#med-refresh').onclick=()=>openMedications(currentPerson,true);
 $('#med-active').onclick=()=>{tab='Active';render();};$('#med-discontinued').onclick=()=>{tab='Discontinued';render();};$('#med-add').onclick=()=>openForm();
 $('#med-short-course').onchange=endFields;
 $('#medication-form').addEventListener('input',()=>formDirty=true);
 $('#medication-form').onsubmit=event=>{event.preventDefault();saveForm();};
 $('#med-form-cancel').onclick=()=>{formDirty=false;$('#medication-form').reset();formDialog.close();};
 formDialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();else{formDirty=false;$('#medication-form').reset();}});
 $('#medication-action-form').onsubmit=event=>{event.preventDefault();performAction();};$('#med-action-cancel').onclick=()=>actionDialog.close();
 actionDialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});
 window.addEventListener('beforeunload',event=>{if(formDirty||pending){event.preventDefault();event.returnValue='';}});
}
export function medicationsSession(ready){
 if(ready){refillsSession(true);if(!active){active=true;epoch++;startupCheck();}return;}
 refillsSession(false);if(!active)return;active=false;epoch++;pending=0;queue=Promise.resolve();resetMedicationSource();clearPrint();$('#med-print-history').checked=false;context=null;currentPerson=null;formState=null;actionState=null;formDirty=false;
 hooks.busy(false);for(const win of [dialog,formDialog,actionDialog]){if(win.open)win.close();document.querySelector(`#window-dock [data-window="${win.id}"]`)?.remove();}
 $('#med-content').replaceChildren();$('#medications-title').textContent='Medications';$('#med-form-title').textContent='Add medication';$('#medication-form').reset();$('#medication-action-form').reset();
 formDisabled(false);actionDialog.querySelectorAll('button').forEach(button=>button.disabled=false);
 for(const id of ['med-status','med-retrieved','med-form-error','med-action-error','med-action-subject','med-end-help','med-action-help'])$('#'+id).textContent='';
}
function startupCheck(){
 run(async stamp=>{const lists=await readAllMedicationLists(people(),knownIds());alive(stamp);
  for(const ctx of lists){if(ctx.error){const name=personById(ctx.personId);hooks.notice('Medication startup check could not finish for '+(name?hooks.personName(name):'a removed person')+': '+ctx.error+' Open this person’s Medications and refresh.');continue;}await rememberLink(ctx,stamp);const result=await completeScheduledCourses(ctx,getCurrentUser());alive(stamp);for(const id of result.completed)audit('scheduled_course_completed',id,ctx.personId,true);if(result.pending.length)hooks.notice('Scheduled medication updates are pending. Open Medications and Retry.');}
 }).catch(error=>{if(active)hooks.notice('Medication check: '+error.message);});
}
export function openMedications(personId,preserveTab=false){
 if(!active)return;const person=personById(personId);if(!person)return;
 if(!preserveTab||currentPerson!==personId)tab='Active';currentPerson=personId;context=null;$('#medications-title').textContent='Medications — '+hooks.personName(person);updateWindowTitle(dialog);$('#med-controls').hidden=true;$('#med-content').replaceChildren(node('p','Retrieving medication list…','small'));status('');showWindow(dialog);
 run(stamp=>load(personId,stamp)).catch(error=>{if(active&&currentPerson===personId)failure(error);});
}
function render(){
 if(!context)return;$('#med-content').replaceChildren();$('#med-controls').hidden=context.missing;
 if(context.missing){const area=node('div',undefined,'med-no-list'),add=node('button','+ Add medication list');add.type='button';add.onclick=()=>{
  if(pending)return;add.disabled=true;
  run(async stamp=>{const person=personById(currentPerson);const result=await createMedicationList(person,knownIds(),window.INFIRMARY_CONFIG?.medicationTimeZone||'America/New_York');alive(stamp);await rememberLink(result,stamp);audit('list_created',String(result.sheetId),person.id);await load(person.id,stamp);}).catch(error=>{if(active)failure(error);});
 };area.append(add);$('#med-content').append(area);return;}
 $('#med-active').setAttribute('aria-pressed',String(tab==='Active'));$('#med-discontinued').setAttribute('aria-pressed',String(tab==='Discontinued'));
 $('#med-retrieved').textContent='Last retrieved '+new Date(context.retrievedAt).toLocaleString()+' · Scheduled ends: '+context.timezone;
 const rows=context.rows.filter(row=>row.status===tab).sort(compareMedications);
 if(!rows.length)$('#med-content').append(node('p',tab==='Active'?'No active medications.':'No discontinued medications.','empty'));
 let prnSection=false;
 for(const entry of rows){
  const prn=isPrnMedication(entry);if(prn&&!prnSection){prnSection=true;$('#med-content').append(node('div','PRN · As needed','med-prn-divider'));}
  const card=node('article',undefined,'med-entry'+(tab==='Discontinued'?' med-history':'')+(prn?' med-prn':''));card.append(node('h3',entry.medication));
  const info=node('dl',undefined,'med-details');for(const [key,label] of [['dose','Dose'],['route','Route'],['frequency','Frequency'],['indication','Indication'],['prescriber','Prescriber'],['startDate','Start date']])if(entry[key])info.append(node('dt',label),node('dd',entry[key]));card.append(info);
  if(entry.instructions)card.append(node('p',entry.instructions,'med-instructions'));
  if(entry.scheduledEnd)card.append(node('p','Short course · scheduled end '+entry.scheduledEnd.replace('T',' ')+(entry.scheduledEnd.length===10?' (through this date)':'')+' · '+context.timezone,'small'));
  if(medicationDue(entry,new Date(),context.timezone))card.append(node('p','Scheduled end passed—update pending','med-pending'));
  if(tab==='Discontinued'){card.append(node('p','Discontinued: '+(entry.discontinuedAt.replace('T',' ')||'date not recorded'),'small'));if(entry.discontinuationReason)card.append(node('p',entry.discontinuationReason,'small'));if(entry.processedAt)card.append(node('p','Automatic completion processed '+new Date(entry.processedAt).toLocaleString(),'small'));}
  const buttons=node('div',undefined,'med-entry-actions');
  for(const [action,label] of tab==='Active'?[['edit','Edit…'],['discontinue','Discontinue…'],['delete','Delete entry…']]:[['delete','Delete entry…']]){const button=node('button',label);button.type='button';button.disabled=pending>0||refillsBusy;button.onclick=()=>action==='edit'?openForm(entry):openAction(entry,action);buttons.append(button);}const refill=node('button','Refills…');refill.type='button';refill.disabled=pending>0||refillsBusy;refill.onclick=()=>{if(!pending&&!refillsBusy)openRefills(currentPerson,entry.id);};buttons.append(refill);card.append(buttons);$('#med-content').append(card);
 }
}
function endFields(){const enabled=$('#med-short-course').checked;$('#med-end-fields').disabled=!enabled;$('#medication-form').elements.endDate.required=enabled;}
function openForm(entry=null){
 if(!context||context.missing||pending)return;
 if(formDirty&&formState){showWindow(formDialog);return;}
 $('#medication-form').reset();formDisabled(false);formState={personId:currentPerson,ctx:context,before:entry,id:entry?.id||crypto.randomUUID(),created:new Date()};formDirty=false;
 const person=personById(currentPerson);$('#med-form-title').textContent=(entry?'Edit medication':'Add medication')+' — '+hooks.personName(person);updateWindowTitle(formDialog);
 for(const key of EDITABLE_MED_FIELDS)if(!['scheduledEnd'].includes(key))$('#medication-form').elements[key].value=entry?.[key]||'';
 $('#med-short-course').checked=Boolean(entry?.scheduledEnd);$('#medication-form').elements.endDate.value=entry?.scheduledEnd.slice(0,10)||'';$('#medication-form').elements.endTime.value=entry?.scheduledEnd.split('T')[1]?.slice(0,5)||'';endFields();
 $('#med-end-help').textContent='Timezone: '+context.timezone+'. Without a time, this medication stays active through the end date.';$('#med-form-error').textContent='';showWindow(formDialog);$('#medication-form').elements.medication.focus();
}
function formDisabled(value){for(const control of $('#medication-form').elements)control.disabled=value;if(!value)endFields();}
async function refreshAfterWrite(personId,stamp){try{await load(personId,stamp);}catch(error){if(active&&currentPerson===personId)failure(error,'Saved to spreadsheet; refresh failed. ');}}
function saveForm(){
 if(pending||!formState)return;const state=formState,form=$('#medication-form'),fields=Object.fromEntries(EDITABLE_MED_FIELDS.map(key=>[key,String(form.elements[key]?.value||'').trim()]));
 fields.scheduledEnd=$('#med-short-course').checked?form.elements.endDate.value+(form.elements.endTime.value?'T'+form.elements.endTime.value:''):'';
 if($('#med-short-course').checked&&!form.elements.endDate.value){$('#med-form-error').textContent='Enter an end date for the short course.';return;}
 const actor=getCurrentUser();if(!actor){$('#med-form-error').textContent='Reconnect Google Drive before saving medications.';return;}
 let entry;try{entry=state.before?reviseMedication(state.before,fields,actor):newMedication(fields,actor,state.created,state.id);}catch(error){$('#med-form-error').textContent=error.message;return;}
 formDisabled(true);$('#med-form-error').textContent='Saving to spreadsheet…';
 run(async stamp=>{if(!personById(state.personId))throw new Error('This person was removed from the directory.');await (state.before?updateMedication(state.ctx,state.before,entry):addMedication(state.ctx,entry));alive(stamp);audit(state.before?'updated':'created',entry.id,state.personId);if(!state.before)tab='Active';formDirty=false;formDialog.close();await refreshAfterWrite(state.personId,stamp);}).catch(error=>{if(active)$('#med-form-error').textContent=error.message;}).finally(()=>formDisabled(false));
}
function openAction(entry,action){
 if(pending)return;actionState={entry,action,ctx:context,personId:currentPerson};$('#medication-action-form').reset();$('#med-action-title').textContent=action==='delete'?'Delete medication entry':'Discontinue medication';$('#med-action-subject').textContent=entry.medication;
 $('#med-discontinue-fields').hidden=action==='delete';$('#med-delete-warning').hidden=action!=='delete';$('#med-discontinue-date').disabled=action==='delete';$('#med-discontinue-reason').disabled=action==='delete';$('#med-discontinue-date').value=localMedicationTime(new Date(),context.timezone).slice(0,10);$('#med-action-help').textContent=action==='delete'?'For errors or duplicates. This clears this entry from the spreadsheet; use Discontinue for treatment that has ended.':'The entry stays in medication history. A restart should be a new entry.';$('#med-action-error').textContent='';showWindow(actionDialog);
}
function performAction(){
 if(pending||!actionState)return;const state=actionState;let changed;
 try{if(state.action==='discontinue')changed=reviseMedication(state.entry,{status:'Discontinued',discontinuedAt:$('#med-discontinue-date').value,discontinuationReason:$('#med-discontinue-reason').value.trim()},getCurrentUser());}catch(error){$('#med-action-error').textContent=error.message;return;}
 for(const control of $('#medication-action-form').elements)control.disabled=true;$('#med-action-error').textContent='Saving to spreadsheet…';
 run(async stamp=>{if(!personById(state.personId))throw new Error('This person was removed.');await (state.action==='delete'?deleteMedication(state.ctx,state.entry):updateMedication(state.ctx,state.entry,changed));alive(stamp);audit(state.action==='delete'?'deleted':'discontinued',state.entry.id,state.personId);actionDialog.close();await refreshAfterWrite(state.personId,stamp);}).catch(error=>{if(active)$('#med-action-error').textContent=error.message;}).finally(()=>{for(const control of $('#medication-action-form').elements)control.disabled=false;$('#med-discontinue-date').disabled=state.action==='delete';$('#med-discontinue-reason').disabled=state.action==='delete';});
}

function printMedications(){
 if(pending||!context||context.missing)return;const personId=currentPerson,history=$('#med-print-history').checked;
 run(async stamp=>{
  const complete=await load(personId,stamp);alive(stamp);if(!complete)throw new Error('Printing stopped: scheduled medication updates are pending. Retry after they succeed.');
  if(currentPerson!==personId||!context||context.missing)throw new Error('Medication list changed. Reopen it before printing.');
  const person=personById(personId);if(!person)throw new Error('This person was removed.');const snapshot=context;
  const columns=['Medication','Dose / Route','Frequency / Instructions','Indication / Prescriber','Dates'];
  const rows=entries=>entries.map(row=>[row.medication,[row.dose,row.route].filter(Boolean).join('\n'),[row.frequency,row.instructions].filter(Boolean).join('\n'),[row.indication&&'Indication: '+row.indication,row.prescriber&&'Prescriber: '+row.prescriber].filter(Boolean).join('\n'),[row.startDate&&'Start: '+row.startDate,row.scheduledEnd&&'Scheduled end: '+row.scheduledEnd.replace('T',' ')+(row.scheduledEnd.length===10?' (through this date)':''),row.status==='Discontinued'&&'Discontinued: '+(row.discontinuedAt||'Not recorded'),row.discontinuationReason].filter(Boolean).join('\n')]);
  const sections=[];for(const state of history?['Active','Discontinued']:['Active']){const entries=snapshot.rows.filter(row=>row.status===state).sort(compareMedications);sections.push(entries.length?{title:state+' medications',repeatIdentity:false,columns,rows:rows(entries)}:{title:state+' medications',lines:['No '+state.toLowerCase()+' medications.']});}
  status('Opening print dialog…');await printDocument({title:'Medication List',person:structuredClone(person),sections,retrievedAt:snapshot.retrievedAt});alive(stamp);audit('print_requested',String(snapshot.sheetId),personId);status('Print dialog requested.');
 }).catch(error=>{if(active)status('Could not print: '+error.message);});
}
