import {findVitalsWorkbook,medicationSheetsRequest as vitalsSheetsRequest,getDriveSessionEpoch,getCurrentUser} from './drive.js?v=0.25.0';
import {VITAL_FIELDS,VITAL_HEADERS,EDITABLE_VITAL_FIELDS,parseVitalRows,vitalToRow,validateVital} from './vitals-model.js?v=0.25.0';
import {medicationSheetTitle,medicationSheetId} from './medications-model.js?v=0.25.0';
const PERSON_KEY='bhr.vitals.personId',ROW_KEY='bhr.vitals.entryId',SCHEMA_KEY='bhr.vitals.schema';
let source,sourceEpoch=-1;
export function resetVitalsSource(){source=null;sourceEpoch=-1;}
const id=value=>{if(typeof value!=='string'||!/^[\w-]+$/.test(value))throw new Error('Invalid spreadsheet ID.');return encodeURIComponent(value);};
const post=(path,body)=>vitalsSheetsRequest(path,{method:'POST',body:JSON.stringify(body)});
function sessionGuard(){const epoch=getDriveSessionEpoch(),actor=getCurrentUser()?.id;return ()=>{if(epoch!==getDriveSessionEpoch()||actor!==getCurrentUser()?.id)throw new Error('Connection changed. Reopen Vital Signs before saving.');};}
function connected(){if(!getCurrentUser())throw new Error('Reconnect Google Drive to identify the user making vital signs changes.');}
export async function vitalsWorkbook(knownIds=[],create=false){
 const unique=[...new Set(knownIds.filter(Boolean))];if(unique.length>1)throw new Error('People are linked to different vital signs workbooks. Resolve the master spreadsheet before editing.');
 const epoch=getDriveSessionEpoch();if(sourceEpoch!==epoch)resetVitalsSource();
 if(!source||unique[0]&&source.id!==unique[0]){const file=await findVitalsWorkbook(unique[0],create);if(epoch!==getDriveSessionEpoch())throw new Error('Connection changed.');source=file;sourceEpoch=epoch;}
 const verified=await findVitalsWorkbook(source.id);if(epoch!==getDriveSessionEpoch())throw new Error('Connection changed.');
 const book=await vitalsSheetsRequest(id(verified.id)+'?fields=spreadsheetId,properties(timeZone),sheets(properties(sheetId,title,gridProperties),developerMetadata),developerMetadata');
 if(epoch!==getDriveSessionEpoch())throw new Error('Connection changed.');
 if(!book.spreadsheetId)throw new Error('Google returned an invalid vital signs workbook.');
 book.sheets??=[];
 // Row metadata must be searched explicitly; Sheet.developerMetadata does not
 // reliably include metadata attached to row dimensions.
 const found=await post(id(book.spreadsheetId)+'/developerMetadata:search',{dataFilters:[{developerMetadataLookup:{metadataKey:ROW_KEY,visibility:'DOCUMENT'}}]});
 for(const sheet of book.sheets)sheet.developerMetadata=(sheet.developerMetadata||[]).filter(meta=>meta.metadataKey!==ROW_KEY);
 for(const match of found.matchedDeveloperMetadata||[]){const meta=match.developerMetadata;if(meta?.metadataKey!==ROW_KEY)continue;const sheet=book.sheets.find(item=>item.properties.sheetId===meta.location?.dimensionRange?.sheetId);if(!sheet)throw new Error('A vital-sign row marker points to an unavailable sheet.');sheet.developerMetadata.push(meta);}
 if(epoch!==getDriveSessionEpoch())throw new Error('Connection changed.');return book;
}
function binding(sheet){return (sheet.developerMetadata||[]).filter(meta=>meta.metadataKey===PERSON_KEY&&meta.location?.sheetId===sheet.properties.sheetId);}
function findSheet(book,person){
 const matches=book.sheets.filter(sheet=>binding(sheet).some(meta=>meta.metadataValue===person.id));
 if(matches.length>1)throw new Error('Multiple vital signs sheets are linked to this person. Resolve the duplicates before editing.');
 const link=person.vitalsSheet;
 if(link){if(link.spreadsheetId!==book.spreadsheetId)throw new Error('This person is linked to a different vital signs workbook.');const sheet=book.sheets.find(item=>item.properties.sheetId===link.sheetId);if(!sheet||!matches.includes(sheet))throw new Error('The linked vital signs sheet is missing or its person marker changed. Restore it before retrying.');return sheet;}
 return matches[0]||null;
}
function markers(sheet){const map=new Map();for(const meta of sheet.developerMetadata||[]){if(meta.metadataKey!==ROW_KEY)continue;if(meta.location?.dimensionRange?.sheetId!==sheet.properties.sheetId||meta.location.dimensionRange.dimension!=='ROWS'||meta.location.dimensionRange.endIndex-meta.location.dimensionRange.startIndex!==1)throw new Error('A vital-sign row marker is invalid.');if(map.has(meta.metadataValue))throw new Error('Duplicate vital-sign row markers found.');map.set(meta.metadataValue,meta.metadataId);}return map;}
const grid=(sheetId,count=VITAL_FIELDS.length)=>({gridRange:{sheetId,startColumnIndex:0,endColumnIndex:Math.min(count,VITAL_FIELDS.length)}});
const rowFilter=metadataId=>({developerMetadataLookup:{metadataId}});
async function getValues(bookId,filters){return post(id(bookId)+'/values:batchGetByDataFilter',{dataFilters:filters,majorDimension:'ROWS',valueRenderOption:'FORMATTED_VALUE'});}
function context(book,person,sheet,values){return {personId:person.id,spreadsheetId:book.spreadsheetId,sheetId:sheet.properties.sheetId,sheetTitle:sheet.properties.title,timezone:book.properties.timeZone,markers:markers(sheet),rows:parseVitalRows(values,markers(sheet)),missing:false};}
export async function readVitalList(person,knownIds=[]){
 let book;try{book=await vitalsWorkbook(knownIds);}catch(error){if(error.code==='VITALS_WORKBOOK_MISSING'&&!person.vitalsSheet&&!knownIds.length)return {personId:person.id,rows:[],missing:true};throw error;}const sheet=findSheet(book,person);if(!sheet)return {personId:person.id,spreadsheetId:book.spreadsheetId,timezone:book.properties.timeZone,rows:[],missing:true};
 const response=await getValues(book.spreadsheetId,[grid(sheet.properties.sheetId,sheet.properties.gridProperties.columnCount)]);return context(book,person,sheet,response.valueRanges?.[0]?.valueRange?.values||[]);
}
const cell=value=>({userEnteredValue:{stringValue:String(value)}});
const cells=values=>({values:values.map(cell)});
export async function createVitalList(person,knownIds=[],timezone='America/New_York'){
 connected();const checkSession=sessionGuard();const book=await vitalsWorkbook(knownIds,true),existing=findSheet(book,person);checkSession();if(existing)return readVitalList(person,knownIds);
 new Intl.DateTimeFormat('en-US',{timeZone:timezone});
 const initialized=(book.developerMetadata||[]).some(meta=>meta.metadataKey===SCHEMA_KEY&&meta.metadataValue==='1');
 const requests=[];
 if(!initialized){
   const check=book.sheets.length?await post(id(book.spreadsheetId)+'/values:batchGetByDataFilter',{dataFilters:book.sheets.map(sheet=>({gridRange:{sheetId:sheet.properties.sheetId}})),majorDimension:'ROWS',valueRenderOption:'FORMULA'}):{};
   if(check.valueRanges?.some(range=>range.valueRange?.values?.some(row=>row.some(value=>String(value).trim()))))throw new Error('The spreadsheet is not blank and is not initialized for BHR. Existing cells were left unchanged.');
   const first=book.sheets[0]||{properties:{sheetId:0}};if(!book.sheets.length)requests.push({addSheet:{properties:{sheetId:0,title:'Sheet1'}}});
   const readmeId=first.properties.sheetId;
   requests.push({updateSheetProperties:{properties:{sheetId:readmeId,title:'Read Me'},fields:'title'}},{updateSpreadsheetProperties:{properties:{timeZone:timezone},fields:'timeZone'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:SCHEMA_KEY,metadataValue:'1',visibility:'DOCUMENT',location:{spreadsheet:true}}}},{updateCells:{start:{sheetId:readmeId,rowIndex:0,columnIndex:0},rows:[cells(['BHR Vital Signs']),cells(['Use BHR to add, edit or delete vital-sign observations.']),cells(['Keep column headings, hidden Entry IDs and row markers intact.']),cells(['Measurement times are stored in UTC; BHR displays them in the viewing device timezone.']),cells(['Enter any subset of measurements; oxygen delivery defaults to RA (room air).']),cells(['Deleted entries leave blank rows to preserve stable targeting during concurrent edits.']),cells(['Keep original measurement units. Height and weight are each selected by their latest measurement time.'])],fields:'userEnteredValue'}},{updateDimensionProperties:{range:{sheetId:readmeId,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{pixelSize:750},fields:'pixelSize'}});
 }
 const sheetId=medicationSheetId(person.id,[0,...book.sheets.map(sheet=>sheet.properties.sheetId)]),title=medicationSheetTitle(person,book.sheets.map(sheet=>sheet.properties.title));
 requests.push({addSheet:{properties:{sheetId,title,gridProperties:{rowCount:1000,columnCount:VITAL_FIELDS.length,frozenRowCount:1}}}},{createDeveloperMetadata:{developerMetadata:{metadataKey:PERSON_KEY,metadataValue:person.id,visibility:'DOCUMENT',location:{sheetId}}}},{updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[cells(VITAL_HEADERS)],fields:'userEnteredValue'}},{repeatCell:{range:{sheetId},cell:{userEnteredFormat:{textFormat:{fontFamily:'Arial',fontSize:10},wrapStrategy:'WRAP',numberFormat:{type:'TEXT'}}},fields:'userEnteredFormat'}},{repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:.8,green:.8,blue:.8},textFormat:{bold:true}}},fields:'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold'}});
 for(const index of [0,16,19,21])requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},properties:{hiddenByUser:true},fields:'hiddenByUser'}});
 checkSession();try{await post(id(book.spreadsheetId)+':batchUpdate',{requests});}
 catch(error){checkSession();const reread=await vitalsWorkbook(knownIds);checkSession();if(!findSheet(reread,person))throw error;}
 return readVitalList(person,[book.spreadsheetId]);
}
async function freshRow(ctx,entry,allowDeleted=false){
 const book=await vitalsWorkbook([ctx.spreadsheetId]),sheet=findSheet(book,{id:ctx.personId,vitalsSheet:{spreadsheetId:ctx.spreadsheetId,sheetId:ctx.sheetId}});
 const marker=markers(sheet).get(entry.id);if(marker!==entry.metadataId){throw new Error('This vital-sign observation’s row marker changed. Refresh before editing.');}
 if(!Number.isInteger(entry.metadataId))throw new Error('The vital-sign observation has no stable row marker. Refresh the list.');
 const response=await getValues(ctx.spreadsheetId,[rowFilter(entry.metadataId)]),values=response.valueRanges?.[0]?.valueRange?.values?.[0]||[];
 if(!values.length||values.every(value=>!String(value).trim())){if(allowDeleted)return null;throw new Error('This vital-sign observation was deleted. Refresh the list.');}
 const actual=VITAL_FIELDS.map((_,i)=>String(values[i]??''));
 if(actual[0]!==entry.id)throw new Error('The row marker and vital-sign observation ID no longer match. No entry was changed.');
 if(JSON.stringify(actual)!==JSON.stringify(entry.baseline))throw new Error('This vital-sign observation changed in the spreadsheet. Refresh and review it before saving.');return actual;
}
export async function addVital(ctx,entry){
 validateVital(entry); connected();if(entry.updatedById!==getCurrentUser().id)throw new Error('Reconnect to identify the observation editor.');const checkSession=sessionGuard();const book=await vitalsWorkbook([ctx.spreadsheetId]),sheet=book.sheets.find(item=>item.properties.sheetId===ctx.sheetId);
 checkSession();if(!sheet||!binding(sheet).some(meta=>meta.metadataValue===ctx.personId))throw new Error('The person’s sheet changed. Refresh before saving.');
 const fresh=await readVitalList({id:ctx.personId,vitalsSheet:{spreadsheetId:ctx.spreadsheetId,sheetId:ctx.sheetId}},[ctx.spreadsheetId]),old=fresh.rows.find(row=>row.id===entry.id);checkSession();
 if(old){if(old.enteredById===entry.enteredById&&EDITABLE_VITAL_FIELDS.every(key=>old[key]===entry[key]))return old;throw new Error('This entry ID already exists with different details. Refresh before editing it.');}
 if(fresh.markers.has(entry.id))throw new Error('This entry was removed. Start a new entry if needed.');
 await ensureGcsColumns(ctx);checkSession();await post(id(ctx.spreadsheetId)+':batchUpdate',{requests:[{insertDimension:{range:{sheetId:ctx.sheetId,dimension:'ROWS',startIndex:1,endIndex:2},inheritFromBefore:false}},{updateCells:{start:{sheetId:ctx.sheetId,rowIndex:1,columnIndex:0},rows:[cells(vitalToRow(entry))],fields:'userEnteredValue'}},{repeatCell:{range:{sheetId:ctx.sheetId,startRowIndex:1,endRowIndex:2},cell:{userEnteredFormat:{textFormat:{bold:false,foregroundColor:{red:0,green:0,blue:0}},numberFormat:{type:'TEXT'}}},fields:'userEnteredFormat.textFormat,userEnteredFormat.numberFormat'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:ROW_KEY,metadataValue:entry.id,visibility:'DOCUMENT',location:{dimensionRange:{sheetId:ctx.sheetId,dimension:'ROWS',startIndex:1,endIndex:2}}}}}]});return entry;
}
export async function updateVital(ctx,before,after){
 validateVital(after); if(after.id!==before.id||after.enteredById!==before.enteredById||after.enteredAt!==before.enteredAt||Number(after.revision)!==Number(before.revision)+1)throw new Error('Observation identity cannot be changed.');
 connected();if(after.updatedById!==getCurrentUser().id)throw new Error('Reconnect to identify the observation editor.');const checkSession=sessionGuard();await freshRow(ctx,before);checkSession();await freshRow(ctx,before);checkSession();
 await ensureGcsColumns(ctx);checkSession();await freshRow(ctx,before);checkSession();await post(id(ctx.spreadsheetId)+'/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:[{dataFilter:rowFilter(before.metadataId),majorDimension:'ROWS',values:[vitalToRow(after)]}]});return after;
}
export async function deleteVital(ctx,entry){
 connected();const checkSession=sessionGuard();if(!await freshRow(ctx,entry,true)){checkSession();return;}checkSession();await freshRow(ctx,entry);checkSession();
 // Clear data through its stable metadata ID. Physically deleting a row by an
 // index could remove the wrong entry after another client inserts rows.
 await ensureGcsColumns(ctx);checkSession();await freshRow(ctx,entry);checkSession();await post(id(ctx.spreadsheetId)+'/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:[{dataFilter:rowFilter(entry.metadataId),majorDimension:'ROWS',values:[VITAL_FIELDS.map(()=>'')]}]});
}

async function ensureGcsColumns(ctx){
 const check=sessionGuard(),book=await vitalsWorkbook([ctx.spreadsheetId]),sheet=findSheet(book,{id:ctx.personId,vitalsSheet:{spreadsheetId:ctx.spreadsheetId,sheetId:ctx.sheetId}});check();
 const count=sheet.properties.gridProperties.columnCount,response=await getValues(ctx.spreadsheetId,[grid(ctx.sheetId,count)]),values=response.valueRanges?.[0]?.valueRange?.values||[];check();parseVitalRows(values,markers(sheet));
 if(VITAL_HEADERS.every((label,i)=>values[0]?.[i]===label))return;
 if(values.some(row=>row.slice(22,25).some(value=>String(value).trim())))throw new Error('The GCS columns contain unexpected data. Existing cells were left unchanged.');
 const requests=[];if(count<VITAL_FIELDS.length)requests.push({updateSheetProperties:{properties:{sheetId:ctx.sheetId,gridProperties:{columnCount:VITAL_FIELDS.length}},fields:'gridProperties.columnCount'}});
 requests.push({updateCells:{start:{sheetId:ctx.sheetId,rowIndex:0,columnIndex:22},rows:[cells(VITAL_HEADERS.slice(22))],fields:'userEnteredValue'}});check();await post(id(ctx.spreadsheetId)+':batchUpdate',{requests});check();
}
