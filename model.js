export const emptyDirectory = () => ({version:1,people:[]});
export function validateDirectory(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.people)) throw new Error('Unsupported directory format (expected version 1).');
  if(data.deleted!==undefined){
    if(!data.deleted||!Array.isArray(data.deleted.people)||!Array.isArray(data.deleted.notes))throw new Error('Invalid deletion markers.');
    const people=new Set(),notes=new Set();
    for(const id of data.deleted.people){if(typeof id!=='string'||!id||people.has(id))throw new Error('Invalid deleted person ID.');people.add(id);}
    for(const entry of data.deleted.notes){const key=JSON.stringify([entry?.personId,entry?.noteId]);if(!entry||typeof entry.personId!=='string'||!entry.personId||typeof entry.noteId!=='string'||!entry.noteId||notes.has(key))throw new Error('Invalid deleted note ID.');notes.add(key);}
  }
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
  return {version:1,people:[...people.values()],...((removedPeople.size||removedNotes.size)?{deleted:{people:[...removedPeople].sort(),notes:[...removedNotes.values()].sort((a,b)=>JSON.stringify([a.personId,a.noteId]).localeCompare(JSON.stringify([b.personId,b.noteId])))}}:{})};
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
export function deathDateError(person,today=new Date()){
  if(person.deceased!==undefined&&typeof person.deceased!=='boolean')return 'Invalid deceased status.';
  if(!person.deathDate)return '';
  if(!person.deceased||typeof person.deathDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(person.deathDate))return 'Enter a valid date of death.';
  const [year,month,day]=person.deathDate.split('-').map(Number);
  if(birthDateError({year:String(year),month:String(month),day:String(day)}))return 'Enter a valid date of death.';
  const local=new Date(0);local.setFullYear(year,month-1,day);local.setHours(0,0,0,0);
  if(local>today)return 'Date of death cannot be in the future.';
  const birth=person.birthDate;if(birth?.year&&birth.month&&birth.day&&calculateAge(birth,local)===null)return 'Date of death cannot precede date of birth.';
  return '';
}
export function personAge(person,today=new Date()){
  if(!person.deceased)return calculateAge(person.birthDate,today);
  if(!person.deathDate)return null;
  const [y,m,d]=person.deathDate.split('-').map(Number);const date=new Date(0);date.setFullYear(y,m-1,d);date.setHours(0,0,0,0);return calculateAge(person.birthDate,date);
}

export function deleteDirectoryEntry(directory,target){
  validateDirectory(directory);
  const next=structuredClone(directory),person=next.people.find(p=>p.id===target.personId);
  if(!person)throw new Error('This person has already been deleted.');
  next.deleted??={people:[],notes:[]};
  if(target.noteId){
    if(!person.notes.some(note=>note.id===target.noteId))throw new Error('This note has already been deleted.');
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
