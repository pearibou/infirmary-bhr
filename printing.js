import {drawVitalTrend} from './vital-trends-chart.js?v=0.31.0';
import {organizationBranding} from './organization.js?v=0.31.0';
// Print documents live only in an ephemeral same-origin frame, never in storage.
import {readPersonPhoto} from './drive.js?v=0.31.0';
import {cleanNoteHtml} from './documents-model.js?v=0.31.0';
import {personName} from './model.js?v=0.31.0';
let frame=null,generation=0,photoUrl=null;
export function clearPrint(){generation++;frame?.remove();frame=null;if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;}
export const fullPersonName=person=>[person.firstName,person.middleName,person.lastName].filter(Boolean).join(' ')||personName(person);
export function personBirthDate(person){const b=person.birthDate;return b&&Object.values(b).some(Boolean)?`${b.month||'—'} / ${b.day||'—'} / ${b.year||'—'}`:'Not recorded';}
export const allergiesText=person=>person.noKnownAllergies?'No known allergies':person.allergies?.trim()||'Not recorded';
const el=(doc,tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
export async function printDocument({title,person,sections,retrievedAt,subtitle='',layout='standard',onLayout}){
 clearPrint();const stamp=generation,branding=await organizationBranding();if(stamp!==generation)throw new Error('Printing cancelled.');frame=document.createElement('iframe');const target=frame;target.id='bhr-print-frame';target.title='Print document';target.setAttribute('aria-hidden','true');target.style.cssText='position:fixed;width:720px;height:960px;left:-10000px;border:0';document.body.append(target);
 const doc=target.contentDocument;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Infirmary document</title></head><body></body></html>');doc.close();
 const style=el(doc,'style');style.textContent=`
 @page{size:auto;margin:13mm}
 *{box-sizing:border-box;min-width:0}html,body{width:auto;max-width:100%;margin:0;padding:0}
 body{font:9.5pt/1.25 Arial,sans-serif;color:#000;background:white}
 header{display:flex;align-items:center;gap:14pt;border-bottom:1pt solid #111;padding-bottom:7pt;margin-bottom:9pt;break-inside:avoid}
 header img{width:63pt;height:63pt;object-fit:contain;flex:none}header p{margin:3pt 0}header h1{overflow-wrap:anywhere}
 h1{font:bold 16pt Georgia,serif;margin:3pt 0}h2{font-size:11pt;margin:8pt 0 5pt}h3{font-size:10pt;margin:6pt 0}
 .clinical-print-text{overflow-wrap:anywhere}.clinical-print-text li{margin:3pt 0}p{margin:4pt 0;white-space:pre-wrap;overflow-wrap:anywhere}
 .identity{display:flex;justify-content:space-between;align-items:center;gap:12pt;border-bottom:1px solid #aaa;padding-bottom:6pt;margin-bottom:7pt;break-inside:avoid}
 .identity h2{margin:0 0 5pt}.identity p{margin:3pt 0}.profile-photo{width:66pt;height:66pt;object-fit:cover;flex:none;border:1px solid #aaa}
 .sections{width:100%;max-width:100%}section{margin-bottom:7pt}
 .demographics{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:16pt;align-items:start}
 .demographics section{break-inside:avoid}.demographics .full-width{grid-column:1/-1}
 .fields{display:grid;grid-template-columns:fit-content(42%) minmax(0,1fr);gap:4pt 7pt;margin:0;font-size:9pt}
 .fields dt,.fields dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.fields dt{font-weight:500}
 table{border-collapse:collapse;width:calc(100% - 1pt);max-width:100%;table-layout:fixed;font-size:8.5pt;box-sizing:border-box}
 thead{display:table-header-group}th,td{text-align:left;vertical-align:top;border:0.6pt solid #888;padding:4pt;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}
 th{background:#eee}tr{break-inside:avoid}.stamp{font-size:7.5pt;color:#444;margin-top:8pt}
 `;doc.head.append(style);
 if(layout==='rundown'){const compact=el(doc,'style');compact.textContent='body{font-size:9pt;line-height:1.15}header{gap:7pt;padding-bottom:4pt;margin-bottom:6pt}header img{width:27pt;height:27pt}header h1{font-size:11pt;margin:0}header p{font-size:9pt;margin:2pt 0}h2{font-size:9.5pt;margin:7pt 0 2pt}section{margin-bottom:5pt}p{margin:2pt 0}.clinical-print-text ul,.clinical-print-text ol{margin:2pt 0;padding-left:16pt}.clinical-print-text li{margin:1pt 0}.clinical-print-text [style]{print-color-adjust:exact;-webkit-print-color-adjust:exact}.stamp{font-size:7pt}';doc.head.append(compact);}
 const header=el(doc,'header'),logo=el(doc,'img');logo.src=branding.logo;logo.alt=branding.name+' logo';const heading=el(doc,'div');heading.append(el(doc,'h1',branding.name),el(doc,'p',title));header.append(logo,heading);doc.body.append(header);
 let identity;
 if(person){
 identity=el(doc,'div');identity.className='identity';const identityText=el(doc,'div');identityText.append(el(doc,'h2',fullPersonName(person)));identity.append(identityText);
 if(personName(person)!==fullPersonName(person))identityText.append(el(doc,'p',personName(person)));
 identityText.append(el(doc,'p','Date of birth: '+personBirthDate(person)),el(doc,'p','Allergies: '+allergiesText(person)));if(person.deceased)identityText.append(el(doc,'p','Deceased'));doc.body.append(identity);
 }
 if(subtitle)doc.body.append(el(doc,'p',subtitle));
 const bodySections=el(doc,'div');bodySections.className='sections'+(layout==='demographics'?' demographics':'');doc.body.append(bodySections);
 for(const section of sections){
  const wrap=el(doc,'section');if(section.fullWidth)wrap.className='full-width';if(section.title)wrap.append(el(doc,'h2',section.title));
  if(section.chart){wrap.append(drawVitalTrend(doc,section.chart));}
  else if(section.columns){
   const table=el(doc,'table'),columns=el(doc,'colgroup'),head=el(doc,'thead'),row=el(doc,'tr');
   for(const [i,column] of section.columns.entries()){const col=el(doc,'col');col.style.width=(section.widths?.[i]||100/section.columns.length)+'%';columns.append(col);const th=el(doc,'th',column);th.scope='col';row.append(th);}
   table.append(columns);
   if(person&&section.repeatIdentity!==false){const patientRow=el(doc,'tr'),patientCell=el(doc,'th',fullPersonName(person)+' · DOB: '+personBirthDate(person));patientCell.colSpan=section.columns.length;patientRow.append(patientCell);head.append(patientRow);}
   head.append(row);table.append(head);const body=el(doc,'tbody');for(const values of section.rows){const tr=el(doc,'tr');for(const [index,value] of values.entries()){const cell=el(doc,'td',String(value??''));if(section.monospaceColumns?.includes(index))cell.style.fontFamily='Courier New, Courier, monospace';tr.append(cell);}body.append(tr);}table.append(body);wrap.append(table);
  }else if(section.html!==undefined){const rich=el(doc,'div');rich.className='clinical-print-text';rich.innerHTML=cleanNoteHtml(section.html,{highlight:layout==='rundown'});wrap.append(rich);}
  else if(section.fields){const fields=el(doc,'dl');fields.className='fields';for(const [label,value] of section.fields)fields.append(el(doc,'dt',label+':'),el(doc,'dd',value||'Not recorded'));wrap.append(fields);}
  else for(const line of section.lines||[])wrap.append(el(doc,'p',line));bodySections.append(wrap);
 }
 const photoReady=(async()=>{
  if(!person?.photo?.fileId)return;
  try{const blob=await readPersonPhoto(person.photo.fileId);if(stamp!==generation)return;photoUrl=URL.createObjectURL(blob);const image=el(doc,'img');image.className='profile-photo';image.alt='Profile photo';image.src=photoUrl;await image.decode();if(stamp===generation)identity.append(image);}catch{/* An unavailable optional photo must not prevent printing. */}
 })();
 doc.body.append(el(doc,'p','Printed: '+new Date().toLocaleString()+(retrievedAt?' · Last retrieved: '+new Date(retrievedAt).toLocaleString():'')));doc.body.lastChild.className='stamp';
 try{await Promise.all([logo.decode(),photoReady]);if(stamp!==generation||!target.isConnected)throw new Error('Printing cancelled.');await doc.fonts.ready;if(stamp!==generation)throw new Error('Printing cancelled.');target.contentWindow.addEventListener('afterprint',()=>{if(frame===target)clearPrint();},{once:true});if(onLayout)onLayout({estimatedPages:Math.max(1,Math.ceil(doc.body.scrollHeight/958))});target.contentWindow.focus();target.contentWindow.print();}catch(error){if(frame===target)clearPrint();throw error;}
}
