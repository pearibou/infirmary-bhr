export const PRESENCE_MIN_INTERVAL=30000,PRESENCE_FALLBACK_INTERVAL=60000,PRESENCE_TTL=180000;
export function validatePresenceIdentity(value){
 if(!value||value.version!==1||!['id','sessionId','name','email'].every(key=>typeof value[key]==='string')||!value.id||value.id.length>200||!/^[\w-]{1,100}$/.test(value.sessionId)||!value.name.trim()||value.name.length>500||value.email.length>320)throw new Error('Invalid shared presence identity.');return value;
}
export function recentPresenceUsers(records,now=Date.now()){
 const users=new Map();for(const record of records){try{validatePresenceIdentity(record);const time=Date.parse(record.lastSeen);if(!Number.isFinite(time)||time>now+60000||now-time>=PRESENCE_TTL)continue;const old=users.get(record.id);if(!old||time>Date.parse(old.lastSeen)||time===Date.parse(old.lastSeen)&&record.sessionId>old.sessionId)users.set(record.id,record);}catch{}}
 return [...users.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(({id,name,email,lastSeen})=>({id,name,email,lastSeen}));
}
