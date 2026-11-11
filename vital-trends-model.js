export const TREND_TYPES={pulse:{label:'Pulse',unit:'bpm',fields:['pulse']},bloodPressure:{label:'Blood pressure',unit:'mmHg',fields:['systolic','diastolic']},weight:{label:'Weight',unit:'lb',units:['lb','kg'],fields:['weight']},temperature:{label:'Temperature',unit:'F',units:['F','C'],fields:['temperature']},oxygenSaturation:{label:'Oxygen saturation',unit:'%',fields:['oxygenSaturation']},respirations:{label:'Respirations',unit:'/min',fields:['respirations']},height:{label:'Height',unit:'in',units:['in','cm'],fields:['height']}};
export function localTrendDate(date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
function dateParts(value){const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)throw new Error('Choose valid start and end dates.');const parts=match.slice(1).map(Number),date=new Date(0);date.setFullYear(parts[0],parts[1]-1,parts[2]);date.setHours(0,0,0,0);if(parts[0]<1||date.getFullYear()!==parts[0]||date.getMonth()!==parts[1]-1||date.getDate()!==parts[2])throw new Error('Choose valid start and end dates.');return {parts,date};}
export function trendPreset(months,now=new Date()){const end=localTrendDate(now);if(!months)return {from:'',to:''};const start=new Date(now);start.setDate(1);start.setMonth(start.getMonth()-months);const last=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();start.setDate(Math.min(now.getDate(),last));return {from:localTrendDate(start),to:end};}
export const trendNumber=value=>Number(value.toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2});
export function buildVitalTrend(rows,{type='pulse',unit,from='',to=''}={}){
 const config=TREND_TYPES[type];if(!config)throw new Error('Choose a measurement.');unit??=config.unit;if(config.units?!config.units.includes(unit):unit!==config.unit)throw new Error('Choose valid graph units.');
 const start=from?dateParts(from).date.getTime():-Infinity;let end=Infinity;if(to){const {date,parts}=dateParts(to);date.setDate(parts[2]+1);end=date.getTime();}if(start>=end)throw new Error('Start date must be on or before end date.');
 const series=config.fields.map(field=>({field,label:field==='systolic'?'Systolic':field==='diastolic'?'Diastolic':config.label,points:[]}));
 for(const row of rows){const time=Date.parse(row.measuredAt);if(!Number.isFinite(time)||time<start||time>=end)continue;for(const line of series){const raw=row[line.field];if(raw===undefined||raw===null||raw==='')continue;let value=Number(raw);if(!Number.isFinite(value))continue;const originalUnit=row[type+'Unit']||config.unit;
 if(type==='weight'&&originalUnit!==unit)value=unit==='kg'?value*.45359237:value/.45359237;
 if(type==='height'&&originalUnit!==unit)value=unit==='cm'?value*2.54:value/2.54;
 if(type==='temperature'&&originalUnit!==unit)value=unit==='C'?(value-32)*5/9:value*9/5+32;
 line.points.push({id:row.id,time,value,original:String(raw)+(type==='temperature'?' °':' ')+originalUnit,oxygenMethod:type==='oxygenSaturation'?row.oxygenMethod||'RA':''});}}
 for(const line of series)line.points.sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));
 const points=series.flatMap(s=>s.points);let minX=Math.min(...points.map(p=>p.time)),maxX=Math.max(...points.map(p=>p.time)),minY=Math.min(...points.map(p=>p.value)),maxY=Math.max(...points.map(p=>p.value));
 if(points.length){if(minX===maxX){minX-=43200000;maxX+=43200000;}const pad=maxY===minY?Math.max(1,Math.abs(minY)*.05):(maxY-minY)*.1;minY-=pad;maxY+=pad;}
 return {type,label:config.label,unit:unit==='F'||unit==='C'?'°'+unit:unit,from,to,series,count:points.length,minX,maxX,minY,maxY};
}
