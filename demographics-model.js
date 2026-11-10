export const DEMOGRAPHIC_FIELDS={sex:'Sex',language:'Primary language',primaryCareProvider:'Primary care provider',email:'Patient e-mail address',religion:'Religion',raceEthnicity:'Race/ethnicity',nationality:'Nationality',origin:'Originally from',address:'Patient address',homePhone:'Home phone number',cellPhone:'Cell phone number',pharmacy:'Preferred pharmacy',pharmacyAddress:'Pharmacy address',pharmacyPhone:'Pharmacy phone number',pharmacyFax:'Pharmacy fax number'};
export const CONTACT_FIELDS={name:'Name',relationship:'Relationship to patient',phone:'Phone number'};
export const POLICY_FIELDS={insurer:'Insurance company',plan:'Plan / policy name',policyNumber:'Policy / member number',groupNumber:'Group number',policyholder:'Policyholder',phone:'Insurance phone number',notes:'Policy notes'};
export function validateDemographics(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid additional information.');
 for(const key of Object.keys(value))if(![...Object.keys(DEMOGRAPHIC_FIELDS),'contacts','policies'].includes(key))throw new Error('Unknown additional information field.');
 for(const key of Object.keys(DEMOGRAPHIC_FIELDS))if(value[key]!==undefined&&(typeof value[key]!=='string'||value[key].length>2000))throw new Error('Invalid additional information field.');
 for(const [key,fields,limit] of [['contacts',CONTACT_FIELDS,50],['policies',POLICY_FIELDS,20]]){
  if(value[key]===undefined)continue;if(!Array.isArray(value[key])||value[key].length>limit)throw new Error('Too many '+key+'.');
  for(const item of value[key]){if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Invalid '+key+'.');for(const [field,entry] of Object.entries(item)){if(key==='contacts'&&field==='emergency'){if(typeof entry!=='boolean')throw new Error('Invalid emergency contact flag.');}else if(!Object.hasOwn(fields,field)||typeof entry!=='string'||entry.length>2000)throw new Error('Invalid '+key+' field.');}}
 }
 return value;
}
