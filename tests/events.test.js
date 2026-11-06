import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvent,mergeEventLogs,recordChanges,eventLogText,parseEventLogText} from '../events.js';
import {emptyDirectory,mergeDirectories,deleteDirectoryEntry} from '../model.js';
const user={id:'staff-a',name:'Synthetic Staff'};
const person=()=>({id:'person-a',name:'Synthetic Brother',firstName:'John',info:'SYNTHETIC CLINICAL CONTENT',updatedAt:new Date().toISOString(),notes:[]});
test('event text round-trips safely and newest entries sort first',()=>{
 const a={...createEvent(user,'person.created','person','a','Record created'),createdAt:'2026-01-01T00:00:00.000Z'};
 const b={...createEvent(user,'person.updated','person','a','Record updated'),createdAt:'2026-01-02T00:00:00.000Z',actorName:'Synthetic\tActor\nSecond line'};
 assert.deepEqual(parseEventLogText(eventLogText([a,b])),mergeEventLogs([a,b]));assert.equal(mergeEventLogs([a],[b])[0].id,b.id);
 assert.throws(()=>mergeEventLogs([a],[{...a,summary:'Altered'}]),/changed/);assert.throws(()=>parseEventLogText('Unrelated existing text file'),/not overwritten/);
});
test('data changes produce append-only metadata without recording clinical content',()=>{
 const before=emptyDirectory(),after={version:1,people:[person()]};let result=recordChanges(before,after,user);
 assert.equal(result.eventLog.length,1);assert.equal(result.eventLog[0].action,'person.created');
 const changed=structuredClone(result);changed.people[0].info='SYNTHETIC SECRET';changed.people[0].notes.push({id:'n',text:'SYNTHETIC NOTE TEXT',createdAt:new Date().toISOString(),authorId:user.id,authorName:user.name});
 result=recordChanges(result,changed,user);assert.equal(result.eventLog.length,3);assert.equal(result.eventLog.filter(e=>e.action==='note.created').length,1);
 const deleted=recordChanges(result,deleteDirectoryEntry(result,{personId:'person-a'}),user);assert.ok(deleted.eventLog.some(e=>e.action==='person.deleted'));assert.ok(deleted.eventLog.some(e=>e.action==='note.deleted'));
 const text=eventLogText(deleted.eventLog);assert.ok(!text.includes('SYNTHETIC SECRET'));assert.ok(!text.includes('SYNTHETIC NOTE TEXT'));assert.ok(!text.includes('SYNTHETIC CLINICAL CONTENT'));
 assert.equal(mergeDirectories(emptyDirectory(),deleted).eventLog.length,deleted.eventLog.length);
});
test('every connected user can trash a shared sticky while preserving its event history',()=>{
 const sticky={id:'s',text:'Synthetic handoff',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),authorId:'staff-a',authorName:'Staff A',x:10,y:10};
 const data=recordChanges(emptyDirectory(),{...emptyDirectory(),desktopNotes:[sticky]},user);
 const other={id:'staff-b',name:'Staff B'},deleted=recordChanges(data,deleteDirectoryEntry(data,{desktopNoteId:'s'},other),other);
 assert.equal(deleted.desktopNotes.length,0);assert.ok(deleted.eventLog.some(e=>e.action==='sticky.deleted'&&e.actorId==='staff-b'));assert.equal(deleted.eventLog.length,2);
});
