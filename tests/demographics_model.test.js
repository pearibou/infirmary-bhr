import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDemographics} from '../demographics-model.js';
import {validateDirectory,mergeDirectories,compareDirectoryPeople} from '../model.js';
import {recordChanges} from '../events.js';
const person=(id,lastName,deceased=false)=>({id,name:'Synthetic '+id,firstName:'Synthetic',lastName,deceased,info:'',notes:[],updatedAt:'2026-11-07T12:00:00Z'});
test('optional structured demographics preserve multiple contacts and insurance through sync',()=>{
 const demographics={language:'Synthetic language',pharmacyAddress:'Synthetic pharmacy address\nSecond line',pharmacyPhone:'555 0100',pharmacyFax:'555 0101',religion:'Synthetic religion',address:'Synthetic address',contacts:[{name:'Synthetic contact',relationship:'Sibling',phone:'+1 555 0100',emergency:true},{name:'Synthetic second',emergency:false}],policies:[{insurer:'Synthetic insurer',policyNumber:'Synthetic member',notes:'Synthetic notes'}]};
 const before={version:1,people:[person('a','Zed')]},after={version:1,people:[{...person('a','Zed'),demographics,updatedAt:'2026-11-07T13:00:00Z'}]};validateDirectory(after);assert.deepEqual(mergeDirectories(before,after).people[0].demographics,demographics);const events=recordChanges(before,after,{id:'synthetic',name:'Synthetic staff'}).eventLog;assert.ok(events.some(e=>e.summary.includes('demographics')));assert.ok(!JSON.stringify(events).includes('Synthetic member'));
});
test('demographics reject malformed contacts and policies without silently dropping records',()=>{
 assert.deepEqual(validateDemographics({}),{});for(const invalid of [{contacts:[{emergency:'yes'}]},{contacts:'bad'},{policies:[{policyNumber:17}]},{address:'x'.repeat(2001)},{policies:Array(21).fill({})},{unexpected:'field'}])assert.throws(()=>validateDemographics(invalid));
});
test('default directory order is living people by surname, independent of storage order',()=>{
 const people=[person('z','Zulu'),person('dead','Aardvark',true),person('a','Alpha')];assert.equal([...people].sort(compareDirectoryPeople)[0].id,'a');assert.equal(people[0].id,'z');
});
