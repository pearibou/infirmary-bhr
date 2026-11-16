import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareCatalog,searchCatalog,newHistory,reviseHistory,historyName,HISTORY_HEADERS,HISTORY_FIELDS,historyToRow,parseHistoryRows,validOnset} from '../history-model.js';
import {emptyDirectory,validateDirectory,mergeDirectories} from '../model.js';
const user={id:'synthetic',name:'Synthetic staff'},catalog=prepareCatalog(JSON.parse(readFileSync(new URL('../data/icd10cm-2027.json',import.meta.url),'utf8')));
test('local public catalog includes selectable diagnosis codes and exact/code/condition searches',()=>{assert.equal(catalog.entries.length,74879);assert.equal(searchCatalog(catalog,'i10')[0].title,'Essential (primary) hypertension');assert.equal(searchCatalog(catalog,'E119')[0].code,'E11.9');assert.equal(searchCatalog(catalog,'E11.9')[0].code,'E11.9');assert.equal(searchCatalog(catalog,'U071')[0].code,'U07.1');assert.ok(searchCatalog(catalog,'HTN').length);assert.equal(searchCatalog(catalog,'xxzznomatch').length,0);assert.equal(searchCatalog(catalog,'a').length,0);assert.ok(!catalog.entries.some(([code])=>code==='E11'));});
test('custom display names retain official title/code/edition and no status is stored',()=>{const entry=newHistory({code:'I10',officialTitle:'Essential (primary) hypertension',edition:catalog.edition,displayName:'Synthetic short name'},user,'a');assert.equal(historyName(entry),'Synthetic short name');assert.equal(entry.code,'I10');assert.equal(entry.onset,'');assert.ok(!HISTORY_FIELDS.includes('status'));const next=reviseHistory(entry,{...entry,displayName:'Synthetic renamed',onset:'2020'},user);assert.equal(next.officialTitle,entry.officialTitle);assert.equal(next.enteredAt,entry.enteredAt);assert.equal(next.revision,'2');const roundtrip=parseHistoryRows([HISTORY_HEADERS,historyToRow(next)],new Map([['a',7]]));assert.equal(roundtrip[0].metadataId,7);});
test('onsets allow unknown/year/month/full dates, validate leap dates, and uncoded entries need a name',()=>{for(const value of ['','1940','2020-02','2020-02-29'])assert.equal(validOnset(value),true);for(const value of ['02','2020-13','2021-02-29','2020-00','2020-01-00'])assert.equal(validOnset(value),false);assert.equal(newHistory({displayName:'Synthetic uncoded'},user).code,'');assert.throws(()=>newHistory({},user));assert.throws(()=>newHistory({code:'I10',displayName:'Missing official title'},user));assert.throws(()=>parseHistoryRows([HISTORY_HEADERS,['bad']],new Map()));});
test('history links are protected directory metadata and survive merging without storing diagnosis rows',()=>{const p={id:'p',name:'Synthetic patient',info:'',notes:[],updatedAt:new Date().toISOString(),historySheet:{spreadsheetId:'synthetic-workbook',sheetId:42}};const merged=mergeDirectories(emptyDirectory(),{version:1,people:[p]});assert.deepEqual(merged.people[0].historySheet,p.historySheet);assert.throws(()=>validateDirectory({version:1,people:[{...p,historySheet:{spreadsheetId:'bad/path',sheetId:-1}}]}));});

test('FY2027 codes validate, including new QA categories, without requiring catalog membership for historical records',()=>{
 for(const [code,officialTitle] of catalog.entries)newHistory({code,officialTitle,edition:catalog.edition},user,'synthetic-validation');
 const old=newHistory({code:'I42.0',officialTitle:'Dilated cardiomyopathy',edition:'ICD-10-CM FY2026, April 1 update'},user,'historical');
 const updated=reviseHistory(old,{...old,notes:'Synthetic note update'},user);assert.equal(updated.code,old.code);assert.equal(updated.officialTitle,old.officialTitle);assert.equal(updated.edition,old.edition);
 assert.ok(!searchCatalog(catalog,'I420').some(row=>row.code==='I42.0'));assert.equal(searchCatalog(catalog,'QA00101')[0].code,'QA0.0101');
});
test('search handles phrasing, abbreviations, prefixes and small spelling mistakes while respecting clinical qualifiers',()=>{
 for(const query of ['the patient has HTN','H.T.N.','hypertenson','hypertensoin','high blood pressure'])assert.ok(searchCatalog(catalog,query).some(r=>r.code==='I10'),query);
 assert.ok(searchCatalog(catalog,'type ii dm without complications').some(r=>r.code==='E11.9'));
 assert.ok(searchCatalog(catalog,'acid reflux').some(r=>r.code.startsWith('K21')));
 assert.ok(searchCatalog(catalog,'heart attack').some(r=>r.title.toLowerCase().includes('infarction')));
 assert.ok(searchCatalog(catalog,'benign prostat hyperplasia').some(r=>r.code.startsWith('N40')));
 assert.ok(searchCatalog(catalog,'hypertension controlled').some(r=>r.code==='I10'&&r.matchKind==='related'));
 for(const row of searchCatalog(catalog,'diabetes without complications'))assert.ok(row.title.toLowerCase().includes('without'));
 assert.equal(searchCatalog(catalog,'I1O').length,0);assert.equal(searchCatalog(catalog,'...').length,0);assert.equal(searchCatalog(catalog,'with controlled').length,0);
});
