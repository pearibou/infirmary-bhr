// Spreadsheet rows are protected runtime data. Dates are ISO wall times in
// the workbook's explicit timezone; no browser-local timezone assumptions.
export const MED_FIELDS=['id','medication','dose','route','frequency','instructions','indication','prescriber','startDate','status','scheduledEnd','discontinuedAt','discontinuationReason','enteredBy','enteredById','enteredAt','updatedBy','updatedById','updatedAt','processedAt','revision'];
export const MED_HEADERS=['Entry ID','Medication','Dose','Route','Frequency','Instructions','Indication','Prescriber','Start date','Status','Scheduled end','Discontinued date','Discontinuation reason','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Completion processed at','Revision'];
export const EDITABLE_MED_FIELDS=['medication','dose','route','frequency','instructions','indication','prescriber','startDate','scheduledEnd'];
export function validMedDate(value,time=false){
 if(!value)return true;const pattern=time?/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/:/^(\d{4})-(\d{2})-(\d{2})$/;const m=String(value).match(pattern);if(!m)return false;
 const [y,mo,d]=m.slice(1,4).map(Number),date=new Date(0);date.setUTCFullYear(y,mo-1,d);date.setUTCHours(0,0,0,0);
 return y>0&&date.getUTCFullYear()===y&&date.getUTCMonth()===mo-1&&date.getUTCDate()===d&&(!m[4]||Number(m[4])<24&&Number(m[5])<60&&(!m[6]||Number(m[6])<60));
}
export function validateMedication(entry){
 if(!entry||typeof entry.id!=='string'||!entry.id||!entry.medication?.trim())throw new Error('Enter a medication name and strength.');
 for(const key of MED_FIELDS)if(typeof entry[key]!=='string'||entry[key].length>5000)throw new Error('Invalid medication field.');
 if(!['Active','Discontinued'].includes(entry.status))throw new Error('Medication status must be Active or Discontinued.');
 if(!validMedDate(entry.startDate)||!validMedDate(entry.scheduledEnd,true)||!validMedDate(entry.discontinuedAt,true))throw new Error('Enter valid medication dates.');
 if(entry.startDate&&entry.scheduledEnd&&entry.scheduledEnd.slice(0,10)<entry.startDate)throw new Error('Scheduled end cannot be before the start date.');
 if(entry.startDate&&entry.discontinuedAt&&entry.discontinuedAt.slice(0,10)<entry.startDate)throw new Error('Discontinued date cannot be before the start date.');
 if(!/^\d+$/.test(entry.revision)||!Number.isSafeInteger(Number(entry.revision))||Number(entry.revision)<1)throw new Error('Invalid medication revision.');return entry;
}
export function rowToMedication(raw,metadataId){
 const cells=MED_FIELDS.map((_,i)=>String(raw[i]??''));if(cells.every(value=>!value.trim()))return null;
 if(!cells[0])throw new Error('A medication row has no Entry ID. Existing cells were left unchanged.');
 const entry=Object.fromEntries(MED_FIELDS.map((key,i)=>[key,cells[i]]));validateMedication(entry);
 if(!Number.isInteger(metadataId))throw new Error('A medication row is missing its stable row marker. Existing cells were left unchanged.');
 return {...entry,metadataId,baseline:cells};
}
export const medicationToRow=entry=>MED_FIELDS.map(key=>String(entry[key]??''));
export function parseMedicationRows(values,metadata){
 if(!MED_HEADERS.every((name,i)=>values[0]?.[i]===name))throw new Error('Medication sheet headings do not match the BHR template. Existing cells were left unchanged.');
 const seen=new Set(),rows=[];
 for(const raw of values.slice(1)){const id=String(raw[0]??''),entry=rowToMedication(raw,metadata.get(id));if(!entry)continue;if(seen.has(entry.id))throw new Error('Duplicate medication entry IDs found. Resolve them in the spreadsheet before editing.');seen.add(entry.id);rows.push(entry);}
 return rows;
}
export function localMedicationTime(now,timezone){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',numberingSystem:'latn'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
export function medicationDue(entry,now,timezone){if(entry.status!=='Active'||!entry.scheduledEnd)return false;const local=localMedicationTime(now,timezone);return entry.scheduledEnd.length===10?local.slice(0,10)>entry.scheduledEnd:local>=entry.scheduledEnd;}
export function newMedication(fields,user,now=new Date(),id=crypto.randomUUID()){
 const stamp=now.toISOString(),entry=Object.fromEntries(MED_FIELDS.map(key=>[key,'']));
 Object.assign(entry,Object.fromEntries(EDITABLE_MED_FIELDS.map(key=>[key,String(fields[key]||'').trim()])),{id,status:'Active',enteredBy:user.name,enteredById:user.id,enteredAt:stamp,updatedBy:user.name,updatedById:user.id,updatedAt:stamp,revision:'1'});return validateMedication(entry);
}
export function reviseMedication(before,changes,user,now=new Date()){
 const next={...before,...changes,updatedBy:user.name,updatedById:user.id,updatedAt:now.toISOString(),revision:String(Number(before.revision)+1)};
 delete next.baseline;delete next.metadataId;return validateMedication(next);
}
export function medicationSheetTitle(person,used=[]){
 const legal=String(person.name||person.preferredName||'Person').trim().split(/\s+/),surname=person.lastName||legal.at(-1),initial=(person.firstName||legal[0]||'').slice(0,1);
 const base=`${surname} ${initial}`.replace(/[\[\]:*?\\/]/g,' ').trim().slice(0,90)||'Person';let title=base,n=2;const names=new Set(used.map(name=>name.toLowerCase()));while(names.has(title.toLowerCase()))title=`${base} (${n++})`;return title;
}
export function medicationSheetId(personId,used=[]){const ids=new Set(used);for(let n=0;n<10000;n++){let hash=2166136261;for(const char of `${personId}:${n}`)hash=Math.imul(hash^char.charCodeAt(0),16777619);const id=(hash>>>0)%2147483646+1;if(!ids.has(id))return id;}throw new Error('Could not allocate a medication sheet ID.');}
