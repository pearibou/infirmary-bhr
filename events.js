// Protected runtime metadata only. Never include clinical text, file bytes or credentials.
const fields=['id','createdAt','actorId','actorName','action','entityType','entityId','personId','summary'];
export function validateEventLog(events){
  if(!Array.isArray(events))throw new Error('Invalid event log.');const ids=new Set();
  for(const event of events){
    if(!event||typeof event!=='object'||Object.keys(event).some(key=>!fields.includes(key))||!['id','createdAt','actorName','action','entityType','entityId','summary'].every(key=>typeof event[key]==='string'&&event[key].trim())||!Number.isFinite(Date.parse(event.createdAt))||new Date(event.createdAt).toISOString()!==event.createdAt||ids.has(event.id))throw new Error('Invalid event log entry.');
    for(const key of ['actorId','personId'])if(event[key]!==undefined&&(typeof event[key]!=='string'||!event[key]))throw new Error('Invalid event identity.');ids.add(event.id);
  }return events;
}
export function mergeEventLogs(a=[],b=[]){
  validateEventLog(a);validateEventLog(b);const entries=new Map();
  for(const event of [...a,...b]){const old=entries.get(event.id);if(old&&fields.some(key=>old[key]!==event[key]))throw new Error('An existing event log entry was changed. Sync stopped to preserve history.');entries.set(event.id,structuredClone(event));}
  return [...entries.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
}
export function createEvent(user,action,entityType,entityId,summary,personId){
  return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),...(user?.id?{actorId:user.id}:{}),actorName:user?.name||'Unidentified connected user',action,entityType,entityId,summary,...(personId?{personId}:{})};
}
export function recordChanges(before,after,user){
  const added=[],emit=(...args)=>added.push(createEvent(user,...args));
  const oldPeople=new Map(before.people.map(p=>[p.id,p])),newPeople=new Map(after.people.map(p=>[p.id,p]));
  for(const person of before.people){if(!newPeople.has(person.id)){emit('person.deleted','person',person.id,'Person record permanently deleted');for(const note of person.notes)emit('note.deleted','note',note.id,'Chronological note removed with deleted person',person.id);}}
  for(const person of after.people){
    const old=oldPeople.get(person.id);
    if(!old)emit('person.created','person',person.id,'Person record created');
    else{const changed=['firstName','middleName','lastName','preferredName','name','birthDate','info','allergies','noKnownAllergies','medicationSheet','historySheet','vitalsSheet','demographics','deceased','deathDate','photo'].filter(key=>JSON.stringify(old[key])!==JSON.stringify(person[key]));if(changed.length)emit('person.updated','person',person.id,'Record fields changed: '+changed.join(', '));}
    const oldNotes=new Map((old?.notes||[]).map(n=>[n.id,n])),newNotes=new Set(person.notes.map(n=>n.id));
    for(const note of old?.notes||[])if(!newNotes.has(note.id))emit('note.deleted','note',note.id,'Chronological note permanently deleted',person.id);
    for(const note of person.notes){const prior=oldNotes.get(note.id);if(!prior)emit('note.created','note',note.id,'Chronological note entered',person.id);else if(JSON.stringify(prior)!==JSON.stringify(note))emit('note.edited','note',note.id,'Chronological note edited; original and revisions retained',person.id);}
    const oldFolders=new Set((old?.driveFolders||[]).map(f=>f.id)),newFolders=new Set((person.driveFolders||[]).map(f=>f.id));
    for(const folder of person.driveFolders||[])if(!oldFolders.has(folder.id))emit('folder.attached','folder',folder.id,'Drive folder attached',person.id);
    for(const folder of old?.driveFolders||[])if(!newFolders.has(folder.id))emit('folder.detached','folder',folder.id,'Drive folder reference removed',person.id);
  }
  const oldStickies=new Map((before.desktopNotes||[]).map(n=>[n.id,n])),newStickies=new Set((after.desktopNotes||[]).map(n=>n.id));
  for(const note of before.desktopNotes||[])if(!newStickies.has(note.id))emit('sticky.deleted','sticky',note.id,'Shared sticky note permanently deleted');
  for(const note of after.desktopNotes||[]){const old=oldStickies.get(note.id);if(!old)emit('sticky.created','sticky',note.id,'Shared sticky note created');else {if(old.text!==note.text||JSON.stringify(old.drawing||[])!==JSON.stringify(note.drawing||[]))emit('sticky.edited','sticky',note.id,'Shared sticky note edited');if(old.x!==note.x||old.y!==note.y)emit('sticky.moved','sticky',note.id,'Shared sticky note moved');}}
  if(JSON.stringify(before.organization)!==JSON.stringify(after.organization))emit('organization.updated','organization','workspace','Organization information updated');
  const knownAlerts=new Set((before.refillAlertEvents||[]).map(e=>e.id));for(const e of after.refillAlertEvents||[])if(!knownAlerts.has(e.id))emit('refill_alert.'+e.kind,'refill_alert',e.id,'Refill alert '+e.kind,e.personId);
  const events=mergeEventLogs(mergeEventLogs(before.eventLog,after.eventLog),added);return {...after,...(events.length?{eventLog:events}:{})};
}
const HEADER='Infirmary BHR Event Log v1 (newest first)\nTime (UTC)\tActor\tAction\tType\tEntry ID\tPerson ID\tDetails\tActor ID\tEvent ID\n';
export function eventLogText(events=[]){
  return HEADER+mergeEventLogs(events).map(e=>[e.createdAt,...[e.actorName,e.action,e.entityType,e.entityId,e.personId||'',e.summary,e.actorId||'',e.id].map(value=>JSON.stringify(value))].join('\t')).join('\n')+(events.length?'\n':'');
}
export function parseEventLogText(text){
  if(!text.startsWith(HEADER))throw new Error('Unrecognized BHR_event_log.txt format. Existing file was not overwritten.');
  const events=text.slice(HEADER.length).split('\n').filter(Boolean).map(line=>{
    const values=line.split('\t');if(values.length!==9)throw new Error('Invalid event log text line.');
    const [actorName,action,entityType,entityId,personId,summary,actorId,id]=values.slice(1).map(value=>JSON.parse(value));
    return {id,createdAt:values[0],actorName,action,entityType,entityId,summary,...(personId?{personId}:{}),...(actorId?{actorId}:{})};
  });return mergeEventLogs(events);
}
