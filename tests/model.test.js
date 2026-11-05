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
