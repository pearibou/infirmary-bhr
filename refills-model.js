import {validMedDate,localMedicationTime} from './medications-model.js?v=0.24.0';
export const REFILL_FIELDS=['id','medicationId','medicationName','lastFilled','daysSupply','rxNumber','refillsRemaining','expires','pharmacy','adjustmentDays','adjustmentReason','enteredBy','enteredById','enteredAt','updatedBy','updatedById','updatedAt','revision'];
export const REFILL_HEADERS=['Refill ID','Medication ID','Medication at entry','Last filled','Days supply','Rx number','Refills remaining','Prescription expires','Dispensing pharmacy','Adjustment days','Adjustment reason','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Revision'];
export const REFILL_EDITABLE=['lastFilled','daysSupply','rxNumber','refillsRemaining','expires','pharmacy','adjustmentDays','adjustmentReason'];
export function validateRefill(value){
 if(!value||REFILL_FIELDS.some(k=>typeof value[k]!=='string'||value[k].length>2000)||!value.id||!value.medicationId||!value.medicationName.trim())throw new Error('Invalid refill record.');
 for(const key of ['lastFilled','expires'])if(!validMedDate(value[key]))throw new Error('Enter valid refill dates.');
 for(const [key,min,max] of [['daysSupply',1,3660],['refillsRemaining',0,999],['adjustmentDays',-3660,3660]])if(value[key]!==''&&(!/^-?\d+$/.test(value[key])||!Number.isSafeInteger(Number(value[key]))||Number(value[key])<min||Number(value[key])>max))throw new Error(key==='daysSupply'?'Days supply must be a whole number from 1 to 3660.':key==='refillsRemaining'?'Refills remaining must be a whole number from 0 to 999.':'Adjustment must be a whole number from −3660 to 3660.');
 if(value.adjustmentDays&&Number(value.adjustmentDays)!==0&&!value.adjustmentReason.trim())throw new Error('Explain the manual supply adjustment.');
 if(!REFILL_EDITABLE.some(k=>value[k].trim()))throw new Error('Enter dispensing or prescription information.');
 for(const key of ['enteredAt','updatedAt'])if(!Number.isFinite(Date.parse(value[key])))throw new Error('Invalid refill timestamp.');
 for(const key of ['enteredBy','enteredById','updatedBy','updatedById'])if(!value[key].trim())throw new Error('Reconnect to identify the refill editor.');
 if(!/^\d+$/.test(value.revision)||!Number.isSafeInteger(Number(value.revision))||Number(value.revision)<1)throw new Error('Invalid refill revision.');return value;
}
export const refillToRow=value=>REFILL_FIELDS.map(k=>value[k]);
export function parseRefills(values,markers){
 if(!REFILL_HEADERS.every((label,i)=>values[0]?.[i]===label))throw new Error('Refill sheet headings do not match the BHR template. Existing cells were left unchanged.');
 const rows=[],seen=new Set();for(const raw of values.slice(1)){const baseline=REFILL_FIELDS.map((_,i)=>String(raw[i]??''));if(baseline.every(s=>!s.trim()))continue;const entry=validateRefill(Object.fromEntries(REFILL_FIELDS.map((k,i)=>[k,baseline[i]])));if(seen.has(entry.id)||!Number.isInteger(markers.get(entry.id)))throw new Error('A refill ID is duplicated or missing its stable row marker. Existing cells were left unchanged.');seen.add(entry.id);rows.push({...entry,baseline,metadataId:markers.get(entry.id)});}return rows;
}
export function newRefill(fields,medication,user,id=crypto.randomUUID(),now=new Date()){
 const entry=Object.fromEntries(REFILL_FIELDS.map(k=>[k,''])),stamp=now.toISOString();Object.assign(entry,Object.fromEntries(REFILL_EDITABLE.map(k=>[k,String(fields[k]??'').trim()])),{id,medicationId:medication.id,medicationName:medication.medication,enteredBy:user.name,enteredById:user.id,enteredAt:stamp,updatedBy:user.name,updatedById:user.id,updatedAt:stamp,revision:'1'});return validateRefill(entry);
}
export function reviseRefill(before,fields,user,now=new Date()){return validateRefill({...Object.fromEntries(REFILL_FIELDS.map(k=>[k,before[k]])),...Object.fromEntries(REFILL_EDITABLE.map(k=>[k,String(fields[k]??'').trim()])),updatedBy:user.name,updatedById:user.id,updatedAt:now.toISOString(),revision:String(Number(before.revision)+1)});}
export function compareRefills(a,b){return (b.lastFilled||b.enteredAt.slice(0,10)).localeCompare(a.lastFilled||a.enteredAt.slice(0,10))||b.enteredAt.localeCompare(a.enteredAt)||b.id.localeCompare(a.id);}
const dayNumber=date=>Date.parse(date+'T12:00:00Z')/86400000;
export function refillEstimate(entry,timezone,now=new Date()){
 const today=localMedicationTime(now,timezone).slice(0,10);if(!entry?.lastFilled||!entry.daysSupply)return {days:null,label:'Not recorded',warnings:[]};
 const elapsed=dayNumber(today)-dayNumber(entry.lastFilled);if(elapsed<0)return {days:null,label:'Supply starts '+entry.lastFilled,warnings:[]};
 const days=Number(entry.daysSupply)-elapsed+Number(entry.adjustmentDays||0);return {days,label:String(days)+' days'+(days<0?' · '+(-days)+' days overdue':''),warnings:days<0?['Estimated supply overdue']:days===0?['Estimated supply exhausted']:days<=7?['Low estimated supply']:[]};
}
export function refillWarnings(entry,timezone,now=new Date()){if(!entry)return [];const warnings=[...refillEstimate(entry,timezone,now).warnings];if(entry.refillsRemaining!==''&&Number(entry.refillsRemaining)===0)warnings.push('No refills remaining');if(entry.expires){const delta=dayNumber(entry.expires)-dayNumber(localMedicationTime(now,timezone).slice(0,10));if(delta<0)warnings.push('Prescription expired');else if(delta<=30)warnings.push('Prescription expires '+entry.expires);}return warnings;}
