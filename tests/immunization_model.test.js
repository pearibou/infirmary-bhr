import test from 'node:test';
import assert from 'node:assert/strict';
import {IMMUNIZATION_FIELDS,IMMUNIZATION_HEADERS,newImmunization,reviseImmunization,immunizationToRow,parseImmunizationRows,latestImmunizations,validImmunizationDate,immunizationDateInput,immunizationDateText} from '../immunization-model.js';
import {validateDirectory,mergeDirectories,emptyDirectory} from '../model.js';
const user={id:'synthetic-staff',name:'Synthetic Staff'};
test('immunizations require only a vaccine name and preserve optional details and attribution',()=>{
 const entry=newImmunization({vaccine:'Synthetic vaccine',administered:'2020-02',lot:'000123',nextDue:'2027-01-01',site:'Left arm',manufacturer:'Synthetic manufacturer',route:'IM',dose:'2',location:'Synthetic pharmacy',comments:'Synthetic comment'},user,'a');
 assert.equal(entry.lot,'000123');assert.equal(entry.revision,'1');assert.ok(!IMMUNIZATION_FIELDS.includes('source'));assert.equal(IMMUNIZATION_FIELDS.length,IMMUNIZATION_HEADERS.length);
 const revised=reviseImmunization(entry,{...entry,comments:'Changed'},user);assert.equal(revised.enteredAt,entry.enteredAt);assert.equal(revised.revision,'2');assert.equal(newImmunization({vaccine:'Synthetic unknown date'},user).administered,'');
 const rows=parseImmunizationRows([IMMUNIZATION_HEADERS,immunizationToRow(revised)],new Map([['a',7]]));assert.equal(rows[0].metadataId,7);assert.deepEqual(rows[0].baseline,immunizationToRow(revised));
 assert.throws(()=>parseImmunizationRows([IMMUNIZATION_HEADERS,immunizationToRow(entry)],new Map()));assert.throws(()=>parseImmunizationRows([IMMUNIZATION_HEADERS,immunizationToRow(entry),immunizationToRow(entry)],new Map([['a',7]])));assert.throws(()=>newImmunization({},user));
});
test('historical dates accept year/month/day, due dates also allow partial dates, and reject invalid calendar days',()=>{
 for(const date of ['','2020','2020-02','2020-02-29'])assert.equal(validImmunizationDate(date),true);
 for(const date of ['02','2020-00','2021-02-29','2020-01-00','0000','2020-13'])assert.equal(validImmunizationDate(date),false);
 assert.equal(newImmunization({vaccine:'Synthetic',nextDue:'02/2020'},user).nextDue,'2020-02');assert.throws(()=>newImmunization({vaccine:'Synthetic',administered:'2021-02-29'},user));
});
test('master summary picks latest administered dose per normalized vaccine name, unknown dates sort last',()=>{
 const make=(id,vaccine,administered)=>newImmunization({vaccine,administered},user,id);
 const rows=[make('a','Synthetic A','2020'),make('b','synthetic a','2024-02-01'),make('c','Synthetic A',''),make('d','Synthetic B','2023')];assert.deepEqual(latestImmunizations(rows).map(row=>row.id),['b','d']);
});
test('immunization links validate and merge without copying private dose rows into directory',()=>{
 const p={id:'p',name:'Synthetic',info:'',notes:[],updatedAt:new Date().toISOString(),immunizationSheet:{spreadsheetId:'synthetic-book',sheetId:42}};assert.deepEqual(mergeDirectories(emptyDirectory(),{version:1,people:[p]}).people[0].immunizationSheet,p.immunizationSheet);assert.throws(()=>validateDirectory({version:1,people:[{...p,immunizationSheet:{spreadsheetId:'bad/path',sheetId:-1}}]}));
});

test('US date entry preserves precision and previously saved ISO cells without a migration',()=>{
 for(const [input,stored,display] of [['1/2/2020','2020-01-02','01/02/2020'],['2/2020','2020-02','02/2020'],['2020','2020','2020'],['','',''],['2020-02-29','2020-02-29','02/29/2020']]){assert.equal(immunizationDateInput(input),stored);assert.equal(immunizationDateText(stored),display);const entry=newImmunization({vaccine:'Synthetic',administered:input,nextDue:input},user,'legacy');const cells=immunizationToRow(entry);const before=parseImmunizationRows([IMMUNIZATION_HEADERS,cells],new Map([['legacy',42]]))[0];assert.deepEqual(before.baseline,cells);const next=reviseImmunization(before,{...before,administered:immunizationDateText(before.administered),nextDue:immunizationDateText(before.nextDue),comments:'Updated'},user);assert.equal(next.administered,stored);assert.equal(next.nextDue,stored);}
 for(const value of ['02/29/2021','13/2020','00/2020','1/0/2020','1/2','02','12/31/0000'])assert.throws(()=>immunizationDateInput(value));
});
