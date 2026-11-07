import test from 'node:test';
import assert from 'node:assert/strict';
import {MED_HEADERS,MED_FIELDS,newMedication,reviseMedication,medicationToRow,parseMedicationRows,medicationDue,localMedicationTime,medicationSheetTitle,medicationSheetId,validMedDate} from '../medications-model.js';
const user={id:'synthetic-staff',name:'Synthetic Staff'},now=new Date('2026-11-07T12:00:00Z');
const make=fields=>newMedication({medication:'Synthetic medicine',...fields},user,now,'entry-a');
test('medication rows round-trip required and optional fields, indication and prescriber',()=>{
 const entry=make({dose:'Synthetic dose',indication:'Synthetic indication',prescriber:'Synthetic prescriber'}),rows=parseMedicationRows([MED_HEADERS,medicationToRow(entry)],new Map([['entry-a',42]]));
 assert.equal(rows[0].indication,'Synthetic indication');assert.equal(rows[0].prescriber,'Synthetic prescriber');assert.equal(rows[0].metadataId,42);assert.equal(MED_FIELDS.length,21);assert.throws(()=>make({medication:''}));
});
test('a short course stays active through its date in Eastern time and respects a specified time',()=>{
 const date=make({scheduledEnd:'2026-11-07'});assert.equal(medicationDue(date,new Date('2026-11-08T04:59:59Z'),'America/New_York'),false);assert.equal(medicationDue(date,new Date('2026-11-08T05:00:00Z'),'America/New_York'),true);
 const timed=make({scheduledEnd:'2026-11-07T20:00'});assert.equal(medicationDue(timed,new Date('2026-11-08T00:59:00Z'),'America/New_York'),false);assert.equal(medicationDue(timed,new Date('2026-11-08T01:00:00Z'),'America/New_York'),true);
 assert.equal(medicationDue({...timed,status:'Discontinued'},new Date('2027-01-01'),'America/New_York'),false);
 assert.equal(localMedicationTime(new Date('2026-07-01T04:00:00Z'),'America/New_York'),'2026-07-01T00:00:00');
});
test('invalid dates and schedules stop before writing',()=>{
 assert.equal(validMedDate('2024-02-29'),true);assert.equal(validMedDate('2025-02-29'),false);assert.throws(()=>make({scheduledEnd:'2026-11-07T24:00'}));assert.throws(()=>make({startDate:'2026-11-08',scheduledEnd:'2026-11-07'}));
});
test('unknown headings, missing row markers and duplicate entry IDs are rejected',()=>{
 const entry=make({}),raw=medicationToRow(entry);assert.throws(()=>parseMedicationRows([['Different'],raw],new Map([['entry-a',1]])));assert.throws(()=>parseMedicationRows([MED_HEADERS,raw],new Map()));assert.throws(()=>parseMedicationRows([MED_HEADERS,raw,raw],new Map([['entry-a',1]])));
 assert.deepEqual(parseMedicationRows([MED_HEADERS,[]],new Map()),[]);
});
test('revisions preserve entry identity and original authorship',()=>{
 const before=make({}),after=reviseMedication(before,{dose:'Changed synthetic dose'}, {id:'another',name:'Another Staff'},now);assert.equal(after.id,before.id);assert.equal(after.enteredById,user.id);assert.equal(after.updatedById,'another');assert.equal(after.revision,'2');
});
test('tab names handle collisions and stable numeric sheet IDs are deterministic',()=>{
 const person={id:'person-a',firstName:'John',lastName:'Smith'};assert.equal(medicationSheetTitle(person,[]),'Smith J');assert.equal(medicationSheetTitle(person,['Smith J']),'Smith J (2)');assert.equal(medicationSheetId(person.id),medicationSheetId(person.id));assert.notEqual(medicationSheetId(person.id,[medicationSheetId(person.id)]),medicationSheetId(person.id));
});


import {isPrnMedication,compareMedications} from '../medications-model.js';
test('PRN detection handles frequency tokens and groups them last without changing records',()=>{
 for(const frequency of ['PRN','prn','Q6H PRN','BID (PRN)','p.r.n.'])assert.equal(isPrnMedication({frequency}),true);
 for(const frequency of ['','Daily','Q6H','imprn','PRNish'])assert.equal(isPrnMedication({frequency}),false);
 const rows=[{id:'a',medication:'Alpha PRN',frequency:'PRN',status:'Active'},{id:'z',medication:'Zulu routine',frequency:'Daily',status:'Active'},{id:'b',medication:'Beta PRN',frequency:'Q6H prn',status:'Active'},{id:'c',medication:'Charlie routine',frequency:'BID',status:'Active'}];
 assert.deepEqual([...rows].sort(compareMedications).map(row=>row.id),['c','z','a','b']);assert.equal(rows[0].id,'a');
 const historical=rows.slice(0,2).map(row=>({...row,status:'Discontinued',discontinuedAt:'2026-11-07',updatedAt:'2026-11-07T12:00:00Z'}));assert.deepEqual(historical.sort(compareMedications).map(row=>row.id),['z','a']);
});
