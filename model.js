import {mergeEventLogs,validateEventLog} from './events.js?v=0.7.4';
export const emptyDirectory = () => ({version:1,people:[]});
export function validateDirectory(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.people)) throw new Error('Unsupported directory format (expected version 1).');
  if(data.deleted!==undefined){
    if(!data.deleted||!Array.isArray(data.deleted.people)||!Array.isArray(data.deleted.notes))throw new Error('Invalid deletion markers.');
    const people=new Set(),notes=new Set();
    for(const id of data.deleted.people){if(typeof id!=='string'||!id||people.has(id))throw new Error('Invalid deleted person ID.');people.add(id);}
    for(const entry of data.deleted.notes){const key=JSON.stringify([entry?.personId,entry?.noteId]);if(!entry||typeof entry.personId!=='string'||!entry.personId||typeof entry.noteId!=='string'||!entry.noteId||notes.has(key))throw new Error('Invalid deleted note ID.');notes.add(key);}
  }
  if(data.desktopNotes!==undefined){
    if(!Array.isArray(data.desktopNotes))throw new Error('Invalid desktop notes.');
    const ids=new Set();for(const note of data.desktopNotes){if(!note||typeof note.id!=='string'||!note.id||ids.has(note.id)||typeof note.text!=='string'||!note.text.trim()||!validDate(note.createdAt)||!validDate(note.updatedAt)||typeof note.authorName!=='string'||!Number.isFinite(note.x)||!Number.isFinite(note.y)||note.x<0||note.y<0)throw new Error('Invalid desktop note.');ids.add(note.id);}
  }
  if(data.deleted?.desktopNotes!==undefined&&(!Array.isArray(data.deleted.desktopNotes)||data.deleted.desktopNotes.some(id=>typeof id!=='string'||!id)||new Set(data.deleted.desktopNotes).size!==data.deleted.desktopNotes.length))throw new Error('Invalid deleted desktop notes.');
  if(data.eventLog!==undefined)validateEventLog(data.eventLog);
  const ids=new Set();
  for(const p of data.people){
    if(!p || typeof p.id!=='string' || !p.id || ids.has(p.id) || typeof p.name!=='string' || !p.name.trim() || (p.room!==undefined && typeof p.room!=='string') || typeof p.info!=='string' || !Array.isArray(p.notes) || !validDate(p.updatedAt)) throw new Error('Invalid person in directory.');
    for(const field of ['firstName','middleName','lastName','preferredName'])if(p[field]!==undefined && typeof p[field]!=='string')throw new Error('Invalid name field.');
    if(p.birthDate!==undefined && (!p.birthDate || typeof p.birthDate!=='object' || birthDateError(p.birthDate)))throw new Error('Invalid birth date.');
    if(p.driveFolders!==undefined){
      if(!Array.isArray(p.driveFolders))throw new Error('Invalid Drive folders.');
      const folders=new Set();
      for(const folder of p.driveFolders){if(!folder || typeof folder.id!=='string' || !/^[\w-]+$/.test(folder.id) || typeof folder.name!=='string' || folders.has(folder.id))throw new Error('Invalid Drive folder link.');folders.add(folder.id);}
    }
    if(deathDateError(p))throw new Error('Invalid date of death.');
    if(p.photo!==undefined&&(!p.photo||typeof p.photo.fileId!=='string'||!/^[\w-]+$/.test(p.photo.fileId)||typeof p.photo.folderId!=='string'||!/^[\w-]+$/.test(p.photo.folderId)))throw new Error('Invalid photo reference.');
    ids.add(p.id); const notes=new Set();
    for(const n of p.notes){if(!n || typeof n.id!=='string' || !n.id || notes.has(n.id) || typeof n.text!=='string' || !n.text.trim() || !validDate(n.createdAt)) throw new Error('Invalid note in directory.'); notes.add(n.id);
      if(n.authorId!==undefined&&(typeof n.authorId!=='string'||!n.authorId||typeof n.authorName!=='string'||!n.authorName.trim()))throw new Error('Invalid note author.');
      if(n.edits!==undefined){
        if(!n.authorId||!Array.isArray(n.edits))throw new Error('Invalid note history.');
        let parent=null;const revisions=new Set();
        for(const edit of n.edits){if(!edit||typeof edit.id!=='string'||!edit.id||revisions.has(edit.id)||edit.parentId!==parent||typeof edit.text!=='string'||!edit.text.trim()||!validDate(edit.editedAt)||edit.editorId!==n.authorId||typeof edit.editorName!=='string'||!edit.editorName.trim())throw new Error('Invalid note revision.');revisions.add(edit.id);parent=edit.id;}
      }
    }
  }
  return data;
}
function validDate(value){return typeof value==='string' && Number.isFinite(Date.parse(value));}
export function mergeDirectories(local,remote){
  validateDirectory(local);validateDirectory(remote);
  const removedPeople=new Set([...(local.deleted?.people||[]),...(remote.deleted?.people||[])]);
  const removedNotes=new Map([...(local.deleted?.notes||[]),...(remote.deleted?.notes||[])].map(entry=>[JSON.stringify([entry.personId,entry.noteId]),{personId:entry.personId,noteId:entry.noteId}]));
  const keepNote=(personId,noteId)=>!removedNotes.has(JSON.stringify([personId,noteId]));
  const clean=person=>({...structuredClone(person),notes:person.notes.filter(note=>keepNote(person.id,note.id)).map(note=>structuredClone(note))});
  const people=new Map(local.people.filter(p=>!removedPeople.has(p.id)).map(p=>[p.id,clean(p)]));
  for(const raw of remote.people){
    if(removedPeople.has(raw.id))continue;
    const incoming=clean(raw);
    const old=people.get(incoming.id);
    if(!old){people.set(incoming.id,structuredClone(incoming));continue;}
    const notes=new Map(old.notes.map(n=>[n.id,n]));
    for(const note of incoming.notes){const existing=notes.get(note.id);notes.set(note.id,existing?mergeNote(existing,note):note);}
    const latest=Date.parse(incoming.updatedAt)>Date.parse(old.updatedAt)?incoming:old;
    const folders=new Map([...(old.driveFolders||[]),...(incoming.driveFolders||[])].map(folder=>[folder.id,folder]));
    people.set(old.id,{...latest,...(folders.size?{driveFolders:[...folders.values()]}:{}),notes:[...notes.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id))});
  }
  const removedDesktop=new Set([...(local.deleted?.desktopNotes||[]),...(remote.deleted?.desktopNotes||[])]),desktop=new Map();
  for(const note of [...(local.desktopNotes||[]),...(remote.desktopNotes||[])]){
    if(removedDesktop.has(note.id))continue;const old=desktop.get(note.id);
    if(old&&['text','createdAt','authorName','authorId'].some(key=>old[key]!==note[key]))throw new Error('Conflicting desktop note. Sync stopped to protect both copies.');
    if(!old||Date.parse(note.updatedAt)>Date.parse(old.updatedAt)||note.updatedAt===old.updatedAt&&JSON.stringify([note.x,note.y])>JSON.stringify([old.x,old.y]))desktop.set(note.id,structuredClone(note));
  }
  const eventLog=mergeEventLogs(local.eventLog,remote.eventLog);
  return {version:1,people:[...people.values()],...(eventLog.length?{eventLog}:{}),...(desktop.size?{desktopNotes:[...desktop.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))}:{}),...((removedPeople.size||removedNotes.size||removedDesktop.size)?{deleted:{people:[...removedPeople].sort(),notes:[...removedNotes.values()].sort((a,b)=>JSON.stringify([a.personId,a.noteId]).localeCompare(JSON.stringify([b.personId,b.noteId]))),...(removedDesktop.size?{desktopNotes:[...removedDesktop].sort()}:{})}}:{})};
}

export function personName(person){
  return person.preferredName?.trim() || [person.firstName,person.lastName].filter(Boolean).join(' ').trim() || person.name || '';
}
export function birthDateError(birth={}){
  const {month='',day='',year=''}=birth;
  for(const [value,max] of [[month,12],[day,31],[year,9999]]){
    if(value!==''&&(!/^\d+$/.test(String(value))||Number(value)<1||Number(value)>max))return 'Enter a valid month (1–12), day (1–31), and year (1–9999), or leave boxes blank.';
  }
  if(month!==''&&day!==''){
    const y=year===''?2000:Number(year),m=Number(month),d=Number(day);
    const date=new Date(0);date.setFullYear(y,m,0);
    if(d>date.getDate())return 'This day does not exist in the selected month.';
  }
  return '';
}
export function parseFolder(value){
  const input=value.trim();
  if(/^[\w-]+$/.test(input))return input;
  try{const url=new URL(input);if(url.protocol!=='https:'||url.hostname!=='drive.google.com')throw new Error();const match=url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)\/?$/);if(match)return match[1];}catch{}
  throw new Error('Use a Google Drive folder link or folder ID.');
}

export function calculateAge(birth,today=new Date()){
  if(!birth || !birth.month || !birth.day || !birth.year || birthDateError(birth))return null;
  const year=Number(birth.year),month=Number(birth.month),day=Number(birth.day);
  let age=today.getFullYear()-year;
  if(today.getMonth()+1<month || (today.getMonth()+1===month && today.getDate()<day))age--;
  return age<0?null:age;
}

export function currentNoteText(note){return note.edits?.at(-1)?.text??note.text;}
export function canEditNote(note,user){return Boolean(user?.id && note.authorId===user.id);}
export function editNote(note,user,text,now=new Date().toISOString()){
  if(!canEditNote(note,user))throw new Error('Only the Google account that entered this note can edit it.');
  if(!text.trim())throw new Error('A note cannot be empty.');
  const next=structuredClone(note);next.edits??=[];
  next.edits.push({id:crypto.randomUUID(),parentId:next.edits.at(-1)?.id??null,text:text.trim(),editedAt:now,editorId:user.id,editorName:user.name});return next;
}
function mergeNote(a,b){
  for(const key of ['id','text','createdAt','authorId','authorName'])if(a[key]!==b[key])throw new Error('Conflicting note IDs or authors. Sync stopped to protect both copies.');
  const revisions=new Map();
  for(const edit of [...(a.edits||[]),...(b.edits||[])]){
    const old=revisions.get(edit.id);if(old&&Object.keys(edit).some(key=>old[key]!==edit[key]))throw new Error('Conflicting note revision. Sync stopped.');revisions.set(edit.id,edit);
  }
  const edits=[];let parent=null;
  while(revisions.size){const children=[...revisions.values()].filter(edit=>edit.parentId===parent);if(children.length!==1)throw new Error('Concurrent note edits conflict. Both copies are retained; resolve before syncing.');const edit=children[0];edits.push(edit);revisions.delete(edit.id);parent=edit.id;}
  return {...a,...(edits.length?{edits}:{})};
}
export function deathDateParts(value){
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){const [year,month,day]=value.split('-');return {month,day,year};}
  return value&&typeof value==='object'?{month:value.month??'',day:value.day??'',year:value.year??''}:{month:'',day:'',year:''};
}
export function deathDateError(person,today=new Date()){
  if(person.deceased!==undefined&&typeof person.deceased!=='boolean')return 'Invalid deceased status.';
  if(!person.deathDate)return '';
  const value=person.deathDate;
  if(!person.deceased||typeof value==='string'&&!/^\d{4}-\d{2}-\d{2}$/.test(value)||typeof value!=='string'&&(!value||typeof value!=='object'||Array.isArray(value)))return 'Enter a valid date of death.';
  const parts=deathDateParts(value),{year,month,day}=parts;
  if(birthDateError(parts))return 'Enter a valid date of death.';
  if(day!==''&&month==='')return 'A day needs a month. Enter a month, year, or month/year if the exact date is unknown.';
  if(year!==''){
    const earliest=new Date(0);earliest.setFullYear(Number(year),month===''?0:Number(month)-1,day===''?1:Number(day));earliest.setHours(0,0,0,0);
    if(earliest>today)return 'Date of death cannot be in the future.';
    const latest=new Date(0);latest.setFullYear(Number(year),month===''?12:Number(month),0);latest.setHours(23,59,59,999);if(day!=='')latest.setDate(Number(day));
    const birth=person.birthDate;
    if(birth?.year&&birth.month&&birth.day&&calculateAge(birth,latest)===null)return 'Date of death cannot precede date of birth.';
  }
  return '';
}
export function formatDeathDate(value){
  const {year,month,day}=deathDateParts(value);
  if(!year&&!month&&!day)return 'Unknown';
  if(year&&month&&day)return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const name=month?new Date(2000,Number(month)-1,1).toLocaleString('en-US',{month:'long'}):'';
  return [name,day?String(day):'',year?String(year):''].filter(Boolean).join(' ');
}
export function personAge(person,today=new Date()){
  if(!person.deceased)return calculateAge(person.birthDate,today);
  const {year,month,day}=deathDateParts(person.deathDate);if(!year||!month||!day)return null;
  const date=new Date(0);date.setFullYear(Number(year),Number(month)-1,Number(day));date.setHours(0,0,0,0);return calculateAge(person.birthDate,date);
}

export function deleteDirectoryEntry(directory,target,user=null){
  validateDirectory(directory);
  const next=structuredClone(directory);
  if(target.desktopNoteId){
    if(!next.desktopNotes?.some(note=>note.id===target.desktopNoteId))throw new Error('This desktop note has already been deleted.');
    next.desktopNotes=next.desktopNotes.filter(note=>note.id!==target.desktopNoteId);next.deleted??={people:[],notes:[]};next.deleted.desktopNotes??=[];next.deleted.desktopNotes.push(target.desktopNoteId);return next;
  }
  const person=next.people.find(p=>p.id===target.personId);
  if(!person)throw new Error('This person has already been deleted.');
  next.deleted??={people:[],notes:[]};
  if(target.noteId){
    const note=person.notes.find(note=>note.id===target.noteId);
    if(!note)throw new Error('This note has already been deleted.');
    if(!canEditNote(note,user))throw new Error('Only the Google account that entered this note can delete it.');
    person.notes=person.notes.filter(note=>note.id!==target.noteId);person.updatedAt=new Date().toISOString();
    next.deleted.notes.push({personId:person.id,noteId:target.noteId});
  }else{next.people=next.people.filter(p=>p.id!==person.id);next.deleted.people.push(person.id);}
  return next;
}

const directoryCollator=new Intl.Collator(undefined,{sensitivity:'base'});
export function compareDirectoryPeople(a,b){
  return Number(Boolean(a.deceased))-Number(Boolean(b.deceased))
    ||directoryCollator.compare(a.lastName?.trim()||personName(a),b.lastName?.trim()||personName(b))
    ||directoryCollator.compare(a.firstName?.trim()||personName(a),b.firstName?.trim()||personName(b))
    ||a.id.localeCompare(b.id);
}
