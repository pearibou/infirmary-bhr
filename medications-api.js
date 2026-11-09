import {findMedicationWorkbook,medicationSheetsRequest,getDriveSessionEpoch,getCurrentUser} from './drive.js?v=0.13.2';
import {MED_FIELDS,MED_HEADERS,EDITABLE_MED_FIELDS,parseMedicationRows,medicationToRow,medicationSheetTitle,medicationSheetId,medicationDue,reviseMedication} from './medications-model.js?v=0.13.2';
const PERSON_KEY='bhr.personId',ROW_KEY='bhr.medicationId',SCHEMA_KEY='bhr.medications.schema';
let source,sourceEpoch=-1;
export function resetMedicationSource(){source=null;sourceEpoch=-1;}
const id=value=>{if(typeof value!=='string'||!/^[\w-]+$/.test(value))throw new Error('Invalid spreadsheet ID.');return encodeURIComponent(value);};
const post=(path,body)=>medicationSheetsRequest(path,{method:'POST',body:JSON.stringify(body)});
function connected(){if(!getCurrentUser())throw new Error('Reconnect Google Drive to identify the user making medication changes.');}
export async function medicationWorkbook(knownIds=[]){
 const unique=[...new Set(knownIds.filter(Boolean))];if(unique.length>1)throw new Error('People are linked to different medication workbooks. Resolve the master spreadsheet before editing.');
 const epoch=getDriveSessionEpoch();if(sourceEpoch!==epoch)resetMedicationSource();
 if(!source||unique[0]&&source.id!==unique[0]){const file=await findMedicationWorkbook(unique[0]);if(epoch!==getDriveSessionEpoch())throw new Error('Connection changed.');source=file;sourceEpoch=epoch;}
 const book=await medicationSheetsRequest(id(source.id)+'?fields=spreadsheetId,properties(timeZone),sheets(properties(sheetId,title,gridProperties),developerMetadata),developerMetadata');
 if(!book.spreadsheetId||!Array.isArray(book.sheets))throw new Error('Google returned an invalid medication workbook.');
 // Row metadata must be searched explicitly; Sheet.developerMetadata does not
 // reliably include metadata attached to row dimensions.
 const found=await post(id(book.spreadsheetId)+'/developerMetadata:search',{dataFilters:[{developerMetadataLookup:{metadataKey:ROW_KEY,visibility:'DOCUMENT'}}]});
 for(const sheet of book.sheets)sheet.developerMetadata=(sheet.developerMetadata||[]).filter(meta=>meta.metadataKey!==ROW_KEY);
 for(const match of found.matchedDeveloperMetadata||[]){const meta=match.developerMetadata;if(meta?.metadataKey!==ROW_KEY)continue;const sheet=book.sheets.find(item=>item.properties.sheetId===meta.location?.dimensionRange?.sheetId);if(!sheet)throw new Error('A medication row marker points to an unavailable sheet.');sheet.developerMetadata.push(meta);}
 return book;
}
function binding(sheet){return (sheet.developerMetadata||[]).filter(meta=>meta.metadataKey===PERSON_KEY&&meta.location?.sheetId===sheet.properties.sheetId);}
function findSheet(book,person){
 const matches=book.sheets.filter(sheet=>binding(sheet).some(meta=>meta.metadataValue===person.id));
 if(matches.length>1)throw new Error('Multiple medication sheets are linked to this person. Resolve the duplicates before editing.');
 const link=person.medicationSheet;
 if(link){if(link.spreadsheetId!==book.spreadsheetId)throw new Error('This person is linked to a different medication workbook.');const sheet=book.sheets.find(item=>item.properties.sheetId===link.sheetId);if(!sheet||!matches.includes(sheet))throw new Error('The linked medication sheet is missing or its person marker changed. Restore it before retrying.');return sheet;}
 return matches[0]||null;
}
function markers(sheet){const map=new Map();for(const meta of sheet.developerMetadata||[]){if(meta.metadataKey!==ROW_KEY)continue;if(meta.location?.dimensionRange?.sheetId!==sheet.properties.sheetId||meta.location.dimensionRange.dimension!=='ROWS'||meta.location.dimensionRange.endIndex-meta.location.dimensionRange.startIndex!==1)throw new Error('A medication row marker is invalid.');if(map.has(meta.metadataValue))throw new Error('Duplicate medication row markers found.');map.set(meta.metadataValue,meta.metadataId);}return map;}
const grid=sheetId=>({gridRange:{sheetId,startColumnIndex:0,endColumnIndex:MED_FIELDS.length}});
const rowFilter=metadataId=>({developerMetadataLookup:{metadataId}});
async function getValues(bookId,filters){return post(id(bookId)+'/values:batchGetByDataFilter',{dataFilters:filters,majorDimension:'ROWS',valueRenderOption:'FORMATTED_VALUE'});}
function context(book,person,sheet,values){return {personId:person.id,spreadsheetId:book.spreadsheetId,sheetId:sheet.properties.sheetId,sheetTitle:sheet.properties.title,timezone:book.properties.timeZone,markers:markers(sheet),rows:parseMedicationRows(values,markers(sheet)),missing:false};}
export async function readMedicationList(person,knownIds=[]){
 const book=await medicationWorkbook(knownIds),sheet=findSheet(book,person);if(!sheet)return {personId:person.id,spreadsheetId:book.spreadsheetId,timezone:book.properties.timeZone,rows:[],missing:true};
 const response=await getValues(book.spreadsheetId,[grid(sheet.properties.sheetId)]);return context(book,person,sheet,response.valueRanges?.[0]?.valueRange?.values||[]);
}
// MatchedValueRange responses identify their sheet in dataFilters. Their array
// position must never decide which patient's rows/metadata are paired together.
function sheetValues(response,sheetId){
 const matches=(response.valueRanges||[]).filter(range=>range.dataFilters?.some(filter=>filter.gridRange?.sheetId===sheetId));
 if(matches.length!==1)throw new Error('Google did not return one unambiguous medication sheet. Refresh to retry.');
 return matches[0].valueRange?.values||[];
}
export async function readAllMedicationLists(people,knownIds=[]){
 const book=await medicationWorkbook(knownIds),linked=people.map(person=>({person,sheet:findSheet(book,person)})).filter(item=>item.sheet);
 if(!linked.length)return [];
 const response=await getValues(book.spreadsheetId,linked.map(item=>grid(item.sheet.properties.sheetId)));
 return linked.map(item=>{try{return context(book,item.person,item.sheet,sheetValues(response,item.sheet.properties.sheetId));}catch(error){return {personId:item.person.id,error:error.message};}});
}
const cell=value=>({userEnteredValue:{stringValue:String(value)}});
const cells=values=>({values:values.map(cell)});
export async function createMedicationList(person,knownIds=[],timezone='America/New_York'){
 connected();const book=await medicationWorkbook(knownIds),existing=findSheet(book,person);if(existing)return readMedicationList(person,knownIds);
 new Intl.DateTimeFormat('en-US',{timeZone:timezone});
 const initialized=(book.developerMetadata||[]).some(meta=>meta.metadataKey===SCHEMA_KEY&&meta.metadataValue==='1');
 const requests=[];
 if(!initialized){
   const check=await getValues(book.spreadsheetId,book.sheets.map(sheet=>({gridRange:{sheetId:sheet.properties.sheetId}})));
   if(check.valueRanges?.some(range=>range.valueRange?.values?.some(row=>row.some(value=>String(value).trim()))))throw new Error('The spreadsheet is not blank and is not initialized for BHR. Existing cells were left unchanged.');
   const first=book.sheets[0];if(!first)throw new Error('A blank spreadsheet needs at least one sheet.');
   const readmeId=first.properties.sheetId;
   requests.push({updateSheetProperties:{properties:{sheetId:readmeId,title:'Read Me'},fields:'title'}},{updateSpreadsheetProperties:{properties:{timeZone:timezone},fields:'timeZone'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:SCHEMA_KEY,metadataValue:'1',visibility:'DOCUMENT',location:{spreadsheet:true}}}},{updateCells:{start:{sheetId:readmeId,rowIndex:0,columnIndex:0},rows:[cells(['BHR Medication Lists']),cells(['Use BHR to create per-person lists and add, edit, discontinue or delete entries.']),cells(['Keep column headings, hidden Entry IDs and row markers intact.']),cells(['Status distinguishes Active from Discontinued; blank rows do not separate history.']),cells([`Timezone: ${timezone}. A scheduled date without time is active through that date.`]),cells(['Deleted entries leave blank rows to preserve stable targeting during concurrent edits.']),cells(['Indication is the prescribing reason; discontinuation reason is separate.'])],fields:'userEnteredValue'}},{updateDimensionProperties:{range:{sheetId:readmeId,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{pixelSize:750},fields:'pixelSize'}});
 }
 const sheetId=medicationSheetId(person.id,book.sheets.map(sheet=>sheet.properties.sheetId)),title=medicationSheetTitle(person,book.sheets.map(sheet=>sheet.properties.title));
 requests.push({addSheet:{properties:{sheetId,title,gridProperties:{rowCount:1000,columnCount:MED_FIELDS.length,frozenRowCount:1}}}},{createDeveloperMetadata:{developerMetadata:{metadataKey:PERSON_KEY,metadataValue:person.id,visibility:'DOCUMENT',location:{sheetId}}}},{updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[cells(MED_HEADERS)],fields:'userEnteredValue'}},{repeatCell:{range:{sheetId},cell:{userEnteredFormat:{textFormat:{fontFamily:'Arial',fontSize:10},wrapStrategy:'WRAP',numberFormat:{type:'TEXT'}}},fields:'userEnteredFormat'}},{repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:.8,green:.8,blue:.8},textFormat:{bold:true}}},fields:'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold'}},{setDataValidation:{range:{sheetId,startRowIndex:1,startColumnIndex:9,endColumnIndex:10},rule:{condition:{type:'ONE_OF_LIST',values:[{userEnteredValue:'Active'},{userEnteredValue:'Discontinued'}]},strict:true,showCustomUi:true}}},{addConditionalFormatRule:{index:0,rule:{ranges:[{sheetId,startRowIndex:1}],booleanRule:{condition:{type:'CUSTOM_FORMULA',values:[{userEnteredValue:'=$J2="Discontinued"'}]},format:{backgroundColor:{red:.94,green:.94,blue:.94},textFormat:{foregroundColor:{red:.45,green:.45,blue:.45}}}}}}});
 for(const index of [0,14,17,20])requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},properties:{hiddenByUser:true},fields:'hiddenByUser'}});
 try{await post(id(book.spreadsheetId)+':batchUpdate',{requests});}
 catch(error){const reread=await medicationWorkbook(knownIds);if(!findSheet(reread,person))throw error;}
 return readMedicationList(person,[book.spreadsheetId]);
}
async function freshRow(ctx,entry,allowDeleted=false){
 const book=await medicationWorkbook([ctx.spreadsheetId]),sheet=findSheet(book,{id:ctx.personId,medicationSheet:{spreadsheetId:ctx.spreadsheetId,sheetId:ctx.sheetId}});
 const marker=markers(sheet).get(entry.id);if(marker!==entry.metadataId){if(allowDeleted&&marker===undefined)return null;throw new Error('This medication’s row marker changed. Refresh before editing.');}
 if(!Number.isInteger(entry.metadataId))throw new Error('The medication has no stable row marker. Refresh the list.');
 const response=await getValues(ctx.spreadsheetId,[rowFilter(entry.metadataId)]),values=response.valueRanges?.[0]?.valueRange?.values?.[0]||[];
 if(!values.length||values.every(value=>!String(value).trim())){if(allowDeleted)return null;throw new Error('This medication was deleted. Refresh the list.');}
 const actual=MED_FIELDS.map((_,i)=>String(values[i]??''));
 if(actual[0]!==entry.id)throw new Error('The row marker and medication ID no longer match. No entry was changed.');
 if(JSON.stringify(actual)!==JSON.stringify(entry.baseline))throw new Error('This medication changed in the spreadsheet. Refresh and review it before saving.');return actual;
}
export async function addMedication(ctx,entry){
 connected();const book=await medicationWorkbook([ctx.spreadsheetId]),sheet=book.sheets.find(item=>item.properties.sheetId===ctx.sheetId);
 if(!sheet||!binding(sheet).some(meta=>meta.metadataValue===ctx.personId))throw new Error('The person’s sheet changed. Refresh before saving.');
 const fresh=await readMedicationList({id:ctx.personId,medicationSheet:{spreadsheetId:ctx.spreadsheetId,sheetId:ctx.sheetId}},[ctx.spreadsheetId]),old=fresh.rows.find(row=>row.id===entry.id);
 if(old){if(EDITABLE_MED_FIELDS.every(key=>old[key]===entry[key]))return old;throw new Error('This entry ID already exists with different details. Refresh before editing it.');}
 if(fresh.markers.has(entry.id))throw new Error('This entry was removed. Start a new entry if needed.');
 await post(id(ctx.spreadsheetId)+':batchUpdate',{requests:[{insertDimension:{range:{sheetId:ctx.sheetId,dimension:'ROWS',startIndex:1,endIndex:2},inheritFromBefore:false}},{updateCells:{start:{sheetId:ctx.sheetId,rowIndex:1,columnIndex:0},rows:[cells(medicationToRow(entry))],fields:'userEnteredValue'}},{repeatCell:{range:{sheetId:ctx.sheetId,startRowIndex:1,endRowIndex:2},cell:{userEnteredFormat:{textFormat:{bold:false,foregroundColor:{red:0,green:0,blue:0}},numberFormat:{type:'TEXT'}}},fields:'userEnteredFormat.textFormat,userEnteredFormat.numberFormat'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:ROW_KEY,metadataValue:entry.id,visibility:'DOCUMENT',location:{dimensionRange:{sheetId:ctx.sheetId,dimension:'ROWS',startIndex:1,endIndex:2}}}}}]});return entry;
}
export async function updateMedication(ctx,before,after){
 connected();await freshRow(ctx,before);await freshRow(ctx,before);
 await post(id(ctx.spreadsheetId)+'/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:[{dataFilter:rowFilter(before.metadataId),majorDimension:'ROWS',values:[medicationToRow(after)]}]});return after;
}
export async function deleteMedication(ctx,entry){
 connected();if(!await freshRow(ctx,entry,true))return;await freshRow(ctx,entry);
 // Clear data through its stable metadata ID. Physically deleting a row by an
 // index could remove the wrong medication after another client inserts rows.
 await post(id(ctx.spreadsheetId)+'/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:[{dataFilter:rowFilter(entry.metadataId),majorDimension:'ROWS',values:[MED_FIELDS.map(()=>'')]}]});
}
export async function completeScheduledCourses(ctx,user,now=new Date()){
 const pending=[],completed=[];
 for(const entry of ctx.rows.filter(row=>medicationDue(row,now,ctx.timezone))){
  const next=reviseMedication(entry,{status:'Discontinued',discontinuedAt:entry.scheduledEnd,discontinuationReason:'Scheduled course completed',processedAt:now.toISOString()}, {id:user.id,name:`Automatic (checked by ${user.name})`},now);
  try{await updateMedication(ctx,entry,next);completed.push(entry.id);}catch(error){pending.push({id:entry.id,error:error.message});}
 }
 return {completed,pending};
}
