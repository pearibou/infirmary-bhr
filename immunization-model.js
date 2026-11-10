export const EDITABLE_IMMUNIZATION_FIELDS=['vaccine','administered','dose','location','nextDue','comments','lot','manufacturer','route','site'];
export const IMMUNIZATION_FIELDS=['id',...EDITABLE_IMMUNIZATION_FIELDS,'enteredBy','enteredById','enteredAt','updatedBy','updatedById','updatedAt','revision'];
export const IMMUNIZATION_HEADERS=['Entry ID','Vaccine','Date administered','Dose / series','Administered by / location','Next dose due','Comments','Lot number','Manufacturer','Route','Injection site','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Revision'];
export function validImmunizationDate(value,partial=true){if(!value)return true;const m=value.match(partial?/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/:/^(\d{4})-(\d{2})-(\d{2})$/);if(!m||+m[1]<1)return false;const month=+(m[2]||1),day=+(m[3]||1),date=new Date(0);date.setUTCFullYear(+m[1],month-1,day);return date.getUTCFullYear()===+m[1]&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;}
export function validateImmunization(entry){
 if(!entry||IMMUNIZATION_FIELDS.some(key=>typeof entry[key]!=='string'||entry[key].length>5000)||!entry.id)throw new Error('Invalid immunization entry.');
 if(!entry.vaccine.trim())throw new Error('Enter a vaccine / immunization name.');
 if(!validImmunizationDate(entry.administered))throw new Error('Date administered must be YYYY, YYYY-MM or YYYY-MM-DD, or left blank.');
 if(!validImmunizationDate(entry.nextDue,false))throw new Error('Next dose due must be a complete YYYY-MM-DD date, or left blank.');
 if(!/^\d+$/.test(entry.revision)||!Number.isSafeInteger(+entry.revision)||+entry.revision<1)throw new Error('Invalid immunization revision.');
 for(const key of ['enteredAt','updatedAt'])if(!Number.isFinite(Date.parse(entry[key])))throw new Error('Invalid immunization timestamp.');
 return entry;
}
export const immunizationToRow=entry=>IMMUNIZATION_FIELDS.map(key=>String(entry[key]??''));
export function parseImmunizationRows(values,metadata){
 if(!IMMUNIZATION_HEADERS.every((title,i)=>values[0]?.[i]===title))throw new Error('Immunizations headings do not match the BHR template. Existing cells were left unchanged.');
 const ids=new Set(),rows=[];for(const row of values.slice(1)){const cells=IMMUNIZATION_FIELDS.map((_,i)=>String(row[i]??''));if(cells.every(value=>!value.trim()))continue;const entry=validateImmunization(Object.fromEntries(IMMUNIZATION_FIELDS.map((key,i)=>[key,cells[i]])));if(ids.has(entry.id))throw new Error('Duplicate immunization entry IDs.');ids.add(entry.id);const metadataId=metadata.get(entry.id);if(!Number.isInteger(metadataId))throw new Error('An immunization entry is missing its stable row marker. Existing cells were left unchanged.');rows.push({...entry,baseline:cells,metadataId});}return rows;
}
export function newImmunization(fields,user,id=crypto.randomUUID(),now=new Date()){
 const stamp=now.toISOString(),entry=Object.fromEntries(IMMUNIZATION_FIELDS.map(key=>[key,'']));Object.assign(entry,Object.fromEntries(EDITABLE_IMMUNIZATION_FIELDS.map(key=>[key,String(fields[key]||'').trim()])),{id,enteredBy:user.name,enteredById:user.id,enteredAt:stamp,updatedBy:user.name,updatedById:user.id,updatedAt:stamp,revision:'1'});return validateImmunization(entry);
}
export function reviseImmunization(before,fields,user,now=new Date()){const entry={...before,...Object.fromEntries(EDITABLE_IMMUNIZATION_FIELDS.map(key=>[key,String(fields[key]||'').trim()])),updatedBy:user.name,updatedById:user.id,updatedAt:now.toISOString(),revision:String(+before.revision+1)};delete entry.metadataId;delete entry.baseline;return validateImmunization(entry);}
export const compareImmunizations=(a,b)=>b.administered.localeCompare(a.administered)||b.enteredAt.localeCompare(a.enteredAt)||a.id.localeCompare(b.id);
// Latest administered record for each vaccine name, keeping unknown dates behind known ones.
export function latestImmunizations(rows){const latest=new Map();for(const row of [...rows].sort(compareImmunizations)){const key=row.vaccine.trim().toLocaleLowerCase();if(!latest.has(key))latest.set(key,row);}return [...latest.values()].sort((a,b)=>a.vaccine.localeCompare(b.vaccine));}
