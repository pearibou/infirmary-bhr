import {getCurrentUser,hasDriveAccess} from './drive.js?v=0.27.0';
import {readRefills,saveRefill,deleteRefill} from './refills-api.js?v=0.27.0';
import {REFILL_EDITABLE,newRefill,reviseRefill,compareRefills,refillEstimate,refillWarnings} from './refills-model.js?v=0.27.0';
import {localMedicationTime,compareMedications} from './medications-model.js?v=0.27.0';
import {showWindow,updateWindowTitle} from './windows.js?v=0.27.0';
const $=s=>document.querySelector(s),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
let hooks,active=false,epoch=0,busy=false,personId=null,medContext=null,context=null,filterId=null,draft=null,dirty=false,deleting=null;
function alive(stamp){if(!active||stamp!==epoch||!hasDriveAccess())throw new Error('Reconnect Google Drive to use refill tracking.');}
function status(text){$('#refill-status').textContent=text;}
function controls(){for(const c of document.querySelectorAll('#refills-dialog button,#refill-form-dialog button,#refill-form-dialog input,#refill-form-dialog textarea,#refill-delete-dialog button'))c.disabled=busy;}
async function run(work){if(busy)return;const stamp=epoch;alive(stamp);busy=true;hooks.busy(true);controls();try{return await work(stamp);}catch(error){if(stamp===epoch)status(error.message);throw error;}finally{if(stamp===epoch){busy=false;hooks.busy(false);controls();}}}
function audit(action,entry){hooks.activity('refill.'+action,'refill',entry.id,'Medication refill '+action,personId);}
async function load(stamp){const meds=await hooks.medications(personId);alive(stamp);if(meds.missing)throw new Error('This medication list is no longer available.');const history=await readRefills(meds);alive(stamp);medContext=meds;context=history;render();status('Last retrieved '+new Date().toLocaleString()+' · Estimates use '+context.timezone);}
function fail(error){context=null;$('#refill-content').replaceChildren(node('p','Refill information is unavailable. '+error.message));const retry=node('button','Retry');retry.type='button';retry.onclick=refresh;$('#refill-content').append(retry);}
function refresh(){if(busy)return;const requestEpoch=epoch;run(stamp=>load(stamp)).catch(error=>{if(active&&epoch===requestEpoch)fail(error);});}
function detail(list,label,value){list.append(node('dt',label),node('dd',value||'Not recorded'));}
function summary(entry){const list=node('dl');list.className='refill-details';detail(list,'Last filled',entry.lastFilled);detail(list,'Days supply',entry.daysSupply);detail(list,'Est. days left',refillEstimate(entry,context.timezone).label);detail(list,'Rx number',entry.rxNumber);detail(list,'Refills left',entry.refillsRemaining);detail(list,'Prescription expires',entry.expires);detail(list,'Dispensing pharmacy',entry.pharmacy);if(entry.adjustmentDays){detail(list,'Adjustment',entry.adjustmentDays+' days');detail(list,'Adjustment reason',entry.adjustmentReason);}return list;}
function render(){
 const area=$('#refill-content');area.replaceChildren();if(!context||!medContext)return;
 const medications=[...medContext.rows].sort((a,b)=>Number(a.status==='Discontinued')-Number(b.status==='Discontinued')||compareMedications(a,b)),ids=new Set(medications.map(m=>m.id));
 for(const r of context.rows)if(!ids.has(r.medicationId)){ids.add(r.medicationId);medications.push({id:r.medicationId,medication:r.medicationName,status:'Removed',removed:true});}
 for(const med of medications.filter(m=>!filterId||m.id===filterId)){
  const card=node('article');card.className='refill-medication';card.dataset.medicationId=med.id;card.append(node('h3',med.medication));if(med.status!=='Active')card.append(node('p',med.status==='Removed'?'Medication removed · refill history retained':'Discontinued medication'));
  const records=context.rows.filter(r=>r.medicationId===med.id).sort(compareRefills),latest=records[0];
  if(latest){card.append(summary(latest));const warnings=refillWarnings(latest,context.timezone,new Date(),hooks.alertSettings?.());if(warnings.length){const warning=node('p',warnings.join(' · '));warning.className='refill-warning';card.append(warning);}}
  else card.append(node('p','No refill information recorded.'));
  if(!med.removed){const add=node('button','+ Record refill');add.type='button';add.onclick=()=>openForm(med);card.append(add);}
  if(records.length){const history=node('details'),caption=node('summary','Refill history ('+records.length+')');history.append(caption);for(const entry of records){const row=node('section');row.className='refill-history-entry';row.append(node('h4',entry.lastFilled||'Fill date not recorded'),summary(entry),node('p','Entered by '+entry.enteredBy+' · '+new Date(entry.enteredAt).toLocaleString()+(entry.revision!=='1'?' · Edited by '+entry.updatedBy+' · '+new Date(entry.updatedAt).toLocaleString():'')));const actions=node('div');actions.className='refill-actions';const edit=node('button','Edit refill…'),remove=node('button','Delete refill…');edit.type=remove.type='button';edit.onclick=()=>openForm(med,entry);remove.onclick=()=>{if(busy)return;deleting=entry;$('#refill-delete-error').textContent='';$('#refill-delete-subject').textContent=med.medication+' · '+(entry.lastFilled||'Date not recorded');showWindow($('#refill-delete-dialog'));};actions.append(edit,remove);row.append(actions);history.append(row);}card.append(history);}
  area.append(card);
 }
 if(!area.children.length)area.append(node('p','No medications available for refill tracking.'));controls();
}
function openForm(med,before=null){
 if(busy||!context)return;if(dirty&&draft){showWindow($('#refill-form-dialog'));return;}
 const form=$('#refill-form');form.reset();const recent=context.rows.filter(r=>r.medicationId===med.id).sort(compareRefills)[0];draft={med,before,ctx:context,id:before?.id||crypto.randomUUID(),created:new Date(),personId};dirty=false;
 $('#refill-form-title').textContent=(before?'Edit refill':'Record refill')+' — '+med.medication;updateWindowTitle($('#refill-form-dialog'));
 for(const key of REFILL_EDITABLE)form.elements[key].value=before?.[key]||'';
 if(!before){form.elements.lastFilled.value=localMedicationTime(new Date(),context.timezone).slice(0,10);form.elements.pharmacy.value=recent?.pharmacy||'';}
 $('#refill-form-error').textContent='';showWindow($('#refill-form-dialog'));form.elements.lastFilled.focus();
}
function submit(){
 if(busy||!draft)return;const state=draft,person=hooks.person(state.personId),actor=getCurrentUser();if(!person||!actor){$('#refill-form-error').textContent='Reconnect and reopen this person before saving.';return;}
 const requestEpoch=epoch,fields=Object.fromEntries(REFILL_EDITABLE.map(k=>[k,$('#refill-form').elements[k].value]));let entry;try{entry=state.before?reviseRefill(state.before,fields,actor):newRefill(fields,state.med,actor,state.id,state.created);}catch(error){$('#refill-form-error').textContent=error.message;return;}
 $('#refill-form-error').textContent='Saving refill…';run(async stamp=>{await saveRefill(state.ctx,person,entry,state.before);alive(stamp);audit(state.before?'updated':'created',entry);dirty=false;draft=null;$('#refill-form').reset();$('#refill-form-dialog').close();try{await load(stamp);}catch(error){if(stamp===epoch){fail(error);status('Saved to spreadsheet; refresh failed. Retry before recording another refill.');}}}).catch(error=>{if(active&&epoch===requestEpoch)$('#refill-form-error').textContent=error.message;});
}
export function initRefills(options){
 hooks=options;$('#refill-refresh').onclick=refresh;$('#refill-show-all').onclick=()=>{filterId=null;render();};$('#refill-form').oninput=()=>dirty=true;$('#refill-form').onsubmit=event=>{event.preventDefault();submit();};$('#refill-cancel').onclick=()=>{if(busy)return;dirty=false;draft=null;$('#refill-form').reset();$('#refill-form-dialog').close();};
 for(const win of [$('#refills-dialog'),$('#refill-form-dialog'),$('#refill-delete-dialog')])win.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 $('#refill-delete-confirm').onclick=()=>{if(busy||!deleting||!context)return;const entry=deleting,requestEpoch=epoch;run(async stamp=>{if(!hooks.person(personId))throw new Error('This person was removed.');await deleteRefill(context,entry);alive(stamp);audit('deleted',entry);deleting=null;$('#refill-delete-dialog').close();try{await load(stamp);}catch(error){if(stamp===epoch){fail(error);status('Refill deleted; refresh failed. Retry.');}}}).catch(error=>{if(active&&epoch===requestEpoch)$('#refill-delete-error').textContent=error.message;});};
 window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
}
export function refillsSession(ready){if(ready){if(!active){active=true;epoch++;}return;}active=false;epoch++;busy=false;dirty=false;personId=null;medContext=null;context=null;filterId=null;draft=null;deleting=null;hooks.busy(false);for(const id of ['refills-dialog','refill-form-dialog','refill-delete-dialog']){const win=$('#'+id);if(win.open)win.close();document.querySelector(`#window-dock [data-window="${id}"]`)?.remove();}$('#refill-content').replaceChildren();$('#refill-form').reset();for(const id of ['refill-status','refill-form-error','refill-delete-error','refill-delete-subject'])$('#'+id).textContent='';$('#refills-title').textContent='Refill tracking';$('#refill-form-title').textContent='Record refill';controls();}
export function openRefills(id,medicationId=null){if(!active||busy)return;if(dirty&&draft){showWindow($('#refill-form-dialog'));return;}const person=hooks.person(id);if(!person)return;personId=id;filterId=medicationId;context=null;medContext=null;$('#refill-content').replaceChildren(node('p','Retrieving refill history…'));$('#refills-title').textContent='Refill tracking — '+hooks.personName(person);updateWindowTitle($('#refills-dialog'));status('');showWindow($('#refills-dialog'));refresh();}
