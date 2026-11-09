import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDirectory,validateDirectory,mergeDirectories} from '../model.js';
const date='2026-11-05T12:00:00Z';
const person=(notes=[])=>({id:'p1',name:'Brother Example',room:'1',info:'',updatedAt:date,notes});
const note=(id,text='A note')=>({id,text,createdAt:date});
test('empty directory is valid',()=>assert.deepEqual(validateDirectory(emptyDirectory()),{version:1,people:[]}));
test('merge retains local and remote notes and is repeatable',()=>{const a={version:1,people:[person([note('a')])]},b={version:1,people:[person([note('b')])]};const merged=mergeDirectories(a,b);assert.equal(merged.people[0].notes.length,2);assert.deepEqual(mergeDirectories(merged,b),merged);assert.equal(a.people[0].notes.length,1);});
test('rejects corrupt data and duplicate IDs',()=>{assert.throws(()=>validateDirectory({version:2,people:[]}));assert.throws(()=>validateDirectory({version:1,people:[person([note('a'),note('a')])]}));assert.throws(()=>validateDirectory({version:1,people:[{...person(),updatedAt:'bad'}]}));});
test('conflicting notes stop sync instead of overwriting',()=>assert.throws(()=>mergeDirectories({version:1,people:[person([note('a')])]},{version:1,people:[person([note('a','Different')])]}),/Conflicting/));
test('newer person details win without dropping old notes',()=>{const merged=mergeDirectories({version:1,people:[person([note('a')])]},{version:1,people:[{...person([note('b')]),room:'2',updatedAt:'2026-11-06T12:00:00Z'}]});assert.equal(merged.people[0].room,'2');assert.equal(merged.people[0].notes.length,2);});

import {personName,birthDateError,parseFolder} from '../model.js';
test('preferred or either legal name is enough; legacy display names survive',()=>{
 assert.equal(personName({preferredName:'Brother John',firstName:'John',lastName:'Doe'}),'Brother John');
 assert.equal(personName({lastName:'Doe'}),'Doe');assert.equal(personName({firstName:'John'}),'John');assert.equal(personName(person()),'Brother Example');
});
test('birth date is optional and supports partial dates but rejects impossible dates',()=>{
 assert.equal(birthDateError({}),'');assert.equal(birthDateError({year:'1940'}),'');assert.equal(birthDateError({month:'2',day:'29',year:'2000'}),'');
 assert.ok(birthDateError({month:'2',day:'29',year:'1900'}));assert.ok(birthDateError({month:'4',day:'31'}));assert.ok(birthDateError({month:'13'}));
});
test('folder links accept only Drive folder URLs or IDs',()=>{
 assert.equal(parseFolder('https://drive.google.com/drive/folders/folder_1?usp=sharing'),'folder_1');assert.equal(parseFolder('https://drive.google.com/drive/u/0/folders/folder_1'),'folder_1');
 assert.throws(()=>parseFolder('javascript:alert(1)'));assert.throws(()=>parseFolder('https://example.com/drive/folders/id'));
});
test('person folder attachments survive merging and old directory validation',()=>{
 const a={...person(),driveFolders:[{id:'folder1',name:'Medical records'}]},b={...person(),driveFolders:[{id:'folder2',name:'Letters'}]};
 const merged=mergeDirectories({version:1,people:[a]},{version:1,people:[b]});assert.equal(merged.people[0].driveFolders.length,2);validateDirectory(merged);
 assert.throws(()=>validateDirectory({version:1,people:[{...person(),driveFolders:[{id:'javascript:bad',name:'Bad'}]}]}));
});

import {calculateAge} from '../model.js';
test('age follows local birthday boundaries and rejects incomplete/future dates',()=>{
 const birth={month:'11',day:'5',year:'1940'};
 assert.equal(calculateAge(birth,new Date(2026,10,4)),85);
 assert.equal(calculateAge(birth,new Date(2026,10,5)),86);
 assert.equal(calculateAge(birth,new Date(2026,10,6)),86);
 assert.equal(calculateAge({year:'1940'},new Date(2026,10,5)),null);
 assert.equal(calculateAge({year:'2030',month:'1',day:'1'},new Date(2026,10,5)),null);
 assert.equal(calculateAge({year:'2000',month:'2',day:'29'},new Date(2025,1,28)),24);
 assert.equal(calculateAge({year:'2000',month:'2',day:'29'},new Date(2025,2,1)),25);
});

import {editNote,currentNoteText,canEditNote,deathDateError,personAge} from '../model.js';
const author={id:'google-author-a',name:'Synthetic Staff A'};
const authored=()=>({...note('authored','Original'),authorId:author.id,authorName:author.name});
test('only original author can edit; original content and timestamp remain immutable',()=>{
 assert.equal(canEditNote(authored(),null),false);assert.equal(canEditNote(note('legacy'),author),false);
 assert.throws(()=>editNote(authored(),{id:'other',name:'Other'},'Changed'),/Only/);
 const edited=editNote(authored(),author,'Correction','2026-11-06T12:00:00Z');assert.equal(edited.text,'Original');assert.equal(edited.createdAt,date);assert.equal(currentNoteText(edited),'Correction');assert.equal(edited.edits[0].editorId,author.id);
});
test('note revisions sync in either direction without reverting an edit',()=>{
 const edited=editNote(authored(),author,'Correction','2026-11-06T12:00:00Z'),second=editNote(edited,author,'Second correction','2026-11-06T13:00:00Z');
 const directory=entry=>({version:1,people:[person([entry])]});
 for(const [a,b] of [[authored(),second],[second,authored()],[edited,second],[second,edited]]){const merged=mergeDirectories(directory(a),directory(b));assert.equal(currentNoteText(merged.people[0].notes[0]),'Second correction');assert.equal(merged.people[0].notes[0].edits.length,2);}
});
test('concurrent note revisions and changed authors stop sync rather than discard history',()=>{
 const a=editNote(authored(),author,'A'),b=editNote(authored(),author,'B'),directory=entry=>({version:1,people:[person([entry])]});
 assert.throws(()=>mergeDirectories(directory(a),directory(b)),/Concurrent/);
 assert.throws(()=>mergeDirectories(directory(authored()),directory({...authored(),authorId:'other'})),/Conflicting/);
 const tampered=structuredClone(a);tampered.edits[0].editorId='other';assert.throws(()=>validateDirectory(directory(tampered)),/revision/);
});
test('deceased record validates dates and age is frozen at death',()=>{
 const record={...person(),birthDate:{month:'1',day:'1',year:'1940'},deceased:true,deathDate:'2020-01-01'};
 assert.equal(deathDateError(record),'');assert.equal(personAge(record,new Date(2026,10,6)),80);
 assert.ok(deathDateError({...record,deathDate:'1930-01-01'}));assert.ok(deathDateError({...record,deathDate:'2020-02-30'}));assert.ok(deathDateError({...record,deathDate:'2999-01-01'}));
 assert.equal(deathDateError({...record,deathDate:''}),'');assert.equal(personAge({...record,deathDate:''}),null);
});
test('photo references validate without storing image data',()=>{
 const directory=entry=>({version:1,people:[entry]});validateDirectory(directory({...person(),photo:{fileId:'private-photo',folderId:'person-folder'}}));
 assert.throws(()=>validateDirectory(directory({...person(),photo:{fileId:'data:image/png;base64,xyz',folderId:'folder'}})),/photo/);
});

import {deleteDirectoryEntry} from '../model.js';
test('person deletion removes all record content and survives stale sync in either direction',()=>{
 const original={version:1,people:[person([authored()])]},deleted=deleteDirectoryEntry(original,{personId:'p1'});
 assert.equal(deleted.people.length,0);assert.deepEqual(deleted.deleted,{people:['p1'],notes:[]});assert.equal(original.people.length,1);
 for(const [a,b] of [[deleted,original],[original,deleted]]){const result=mergeDirectories(a,b);assert.equal(result.people.length,0);assert.deepEqual(result.deleted.people,['p1']);}
});
test('note deletion preserves person and other notes, including when stale edits conflict',()=>{
 const original={version:1,people:[person([authored(),note('keep')])]},deleted=deleteDirectoryEntry(original,{personId:'p1',noteId:'authored'},author);
 assert.equal(deleted.people[0].notes.length,1);assert.equal(deleted.people[0].notes[0].id,'keep');
 const stale={version:1,people:[person([{...authored(),text:'stale changed text'},note('keep')])]};
 for(const [a,b] of [[deleted,stale],[stale,deleted]]){const result=mergeDirectories(a,b);assert.equal(result.people[0].notes.length,1);assert.equal(result.people[0].notes[0].id,'keep');}
 assert.throws(()=>deleteDirectoryEntry(deleted,{personId:'p1',noteId:'authored'}),/already/);
});
test('deletion marker validation rejects invalid metadata',()=>{
 assert.throws(()=>validateDirectory({version:1,people:[],deleted:{people:['same','same'],notes:[]}}),/deleted/);
 assert.throws(()=>validateDirectory({version:1,people:[],deleted:{people:[],notes:[{personId:'p',noteId:''}]}}),/deleted/);
});

import {compareDirectoryPeople} from '../model.js';
test('directory groups living before deceased and sorts each by surname, ignoring display name',()=>{
 const entries=[{id:'1',firstName:'A',lastName:'Zulu',preferredName:'Brother Alpha'}, {id:'2',firstName:'Z',lastName:'Adams',preferredName:'Brother Zulu'}, {id:'3',firstName:'A',lastName:'Adams',deceased:true}, {id:'4',firstName:'B',lastName:'zulu',deceased:true}];
 assert.deepEqual(entries.toSorted(compareDirectoryPeople).map(p=>p.id),['2','1','3','4']);
 assert.equal(personName({...entries[0],middleName:'James'}),'Brother Alpha');
 assert.equal(personName({firstName:'John',middleName:'J.',lastName:'Smith'}),'John Smith');
});
test('middle name is optional text and survives directory merge',()=>{
 const entry={...person(),middleName:'J.'};validateDirectory({version:1,people:[entry]});
 assert.equal(mergeDirectories(emptyDirectory(),{version:1,people:[entry]}).people[0].middleName,'J.');
 assert.throws(()=>validateDirectory({version:1,people:[{...entry,middleName:123}]}),/name/);
});

import {deathDateParts,formatDeathDate} from '../model.js';
test('partial death dates retain precision and reject isolated days',()=>{
 const p={...person(),deceased:true};
 for(const deathDate of [{month:'5',day:'',year:''},{month:'',day:'',year:'2020'},{month:'5',day:'',year:'2020'},{month:'5',day:'3',year:''}]){assert.equal(deathDateError({...p,deathDate}),'');assert.equal(personAge({...p,deathDate}),null);}
 assert.ok(deathDateError({...p,deathDate:{day:'3'}}));assert.ok(deathDateError({...p,deathDate:{day:'3',year:'2020'}}));
 assert.ok(deathDateError({...p,deathDate:{month:'2',day:'30',year:'2020'}}));assert.ok(deathDateError({...p,deathDate:{year:'2999'}}));
 assert.equal(formatDeathDate({month:'5'}),'May');assert.equal(formatDeathDate({year:'2020'}),'2020');assert.equal(formatDeathDate({month:'5',year:'2020'}),'May 2020');assert.deepEqual(deathDateParts('2020-05-03'),{year:'2020',month:'05',day:'03'});
});
test('shared desktop notes merge, retain newest position and honor deletion markers',()=>{
 const note={id:'sticky1',text:'Synthetic handoff',authorName:'Synthetic Staff',createdAt:date,updatedAt:date,x:10,y:20};
 const a={...emptyDirectory(),desktopNotes:[note]},b={...emptyDirectory(),desktopNotes:[{...note,x:80,updatedAt:'2026-11-06T12:00:00Z'}]};
 assert.equal(mergeDirectories(a,b).desktopNotes[0].x,80);assert.equal(mergeDirectories(b,a).desktopNotes[0].x,80);
 const deleted=deleteDirectoryEntry(a,{desktopNoteId:'sticky1'});assert.equal(deleted.desktopNotes.length,0);
 assert.equal(mergeDirectories(deleted,b).desktopNotes,undefined);assert.equal(mergeDirectories(b,deleted).desktopNotes,undefined);
 assert.deepEqual(deleted.deleted.desktopNotes,['sticky1']);assert.throws(()=>validateDirectory({...a,desktopNotes:[{...note,x:NaN}]}),/desktop/);
});

test('chronological deletion requires the current original author, including after account changes',()=>{
 const directory={version:1,people:[person([authored(),note('legacy')])]};
 for(const user of [null,{id:'another-user',name:'Other'}])assert.throws(()=>deleteDirectoryEntry(directory,{personId:'p1',noteId:'authored'},user),/Only/);
 assert.throws(()=>deleteDirectoryEntry(directory,{personId:'p1',noteId:'legacy'},author),/Only/);
 const deleted=deleteDirectoryEntry(directory,{personId:'p1',noteId:'authored'},author);assert.equal(deleted.people[0].notes.length,1);assert.equal(directory.people[0].notes.length,2);
});

test('optional allergies and no-known-allergies state validate and survive newer-record sync',()=>{
 const legacy={version:1,people:[person()]};validateDirectory(legacy);
 const known={...person(),allergies:'Synthetic substance',noKnownAllergies:false,updatedAt:'2026-11-06T12:00:00Z'};
 const next=mergeDirectories(legacy,{version:1,people:[known]});
 assert.equal(next.people[0].allergies,'Synthetic substance');
 const none={...known,allergies:'',noKnownAllergies:true,updatedAt:'2026-11-07T12:00:00Z'};
 assert.equal(mergeDirectories(next,{version:1,people:[none]}).people[0].noKnownAllergies,true);
 assert.throws(()=>validateDirectory({version:1,people:[{...known,allergies:123}]}),/allergies/);
 assert.throws(()=>validateDirectory({version:1,people:[{...known,noKnownAllergies:'yes'}]}),/allergies/);
});


test('medication linkage survives directory sync and rejects malformed destinations',()=>{
 const linked={...person(),medicationSheet:{spreadsheetId:'synthetic-workbook',sheetId:42},updatedAt:'2026-11-07T12:00:00Z'};
 const merged=mergeDirectories({version:1,people:[person()]},{version:1,people:[linked]});
 assert.deepEqual(merged.people[0].medicationSheet,linked.medicationSheet);
 for(const medicationSheet of [null,{spreadsheetId:'bad/url',sheetId:1},{spreadsheetId:'synthetic',sheetId:-1},{spreadsheetId:'synthetic',sheetId:'42'}])assert.throws(()=>validateDirectory({version:1,people:[{...linked,medicationSheet}]}),/medication sheet/);
});


import {currentNoteTime} from '../model.js';
test('quick-note date corrections preserve immutable original time and merge with stale copies',()=>{
 const original={id:'dated',text:'Synthetic note',createdAt:date,authorId:'synthetic',authorName:'Synthetic author'};
 const corrected=editNote(original,{id:'synthetic',name:'Synthetic author'},'Synthetic correction','2026-11-07T14:00:00Z','2026-11-01T09:30:00Z');
 assert.equal(corrected.createdAt,date);assert.equal(currentNoteTime(corrected),'2026-11-01T09:30:00.000Z');assert.equal(corrected.edits[0].editedAt,'2026-11-07T14:00:00Z');
 const directory={version:1,people:[person([corrected])]},old={version:1,people:[person([original])]};assert.equal(currentNoteTime(mergeDirectories(directory,old).people[0].notes[0]),currentNoteTime(corrected));
 const tampered=structuredClone(corrected);delete tampered.edits[0].noteAt;assert.throws(()=>mergeDirectories(directory,{version:1,people:[person([tampered])]}),/revision/);
 assert.throws(()=>editNote(original,{id:'other',name:'Other'},'No','2026-11-07T14:00:00Z','2026-11-01T09:30:00Z'),/Only/);assert.throws(()=>editNote(original,{id:'synthetic',name:'Synthetic'},'No',date,'bad'),/date/);
});

test('folder detach markers survive stale sync and allow intentional later reattachment',async()=>{
 const {changeFolderLink}=await import('../model.js');const p={id:'folder-person',name:'Synthetic person',info:'',notes:[],updatedAt:'2026-11-09T12:00:00Z',driveFolders:[{id:'folder-a',name:'Synthetic folder'}]},wrap=p=>({version:1,people:[p]});
 const detached=changeFolderLink(p,p.driveFolders[0],false,new Date('2026-11-09T12:01:00Z'));validateDirectory(wrap(detached));assert.equal(detached.driveFolders.length,0);
 for(const [a,b] of [[detached,p],[p,detached]])assert.deepEqual(mergeDirectories(wrap(a),wrap(b)).people[0].driveFolders,[]);
 const reattached=changeFolderLink(detached,p.driveFolders[0],true,new Date('2026-11-09T12:02:00Z'));
 for(const [a,b] of [[detached,reattached],[reattached,detached]])assert.equal(mergeDirectories(wrap(a),wrap(b)).people[0].driveFolders[0].id,'folder-a');
 assert.throws(()=>validateDirectory(wrap({...p,folderLinkStates:[{id:'bad/id',attached:false,updatedAt:p.updatedAt}]})));
});
