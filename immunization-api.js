import {findImmunizationWorkbook,medicationSheetsRequest as immunizationSheetsRequest,getDriveSessionEpoch,getCurrentUser} from './drive.js?v=0.31.1';
import {IMMUNIZATION_FIELDS,IMMUNIZATION_HEADERS,EDITABLE_IMMUNIZATION_FIELDS,parseImmunizationRows,immunizationToRow} from './immunization-model.js?v=0.31.1';
import {medicationSheetTitle,medicationSheetId} from './medications-model.js?v=0.31.1';
const PERSON_KEY='bhr.immunization.personId',ROW_KEY='bhr.immunization.entryId',SCHEMA_KEY='bhr.immunization.schema';
let source,sourceEpoch=-1;
export function resetImmunizationSource(){source=null;sourceEpoch=-1;}
const id=value=>{if(typeof value!=='string'||!/^[\w-]+$/.test(value))throw new Error('Invalid spreadsheet ID.');return encodeURIComponent(value);};
const post=(path,body)=>immunizationSheetsRequest(path,{method:'POST',body:JSON.stringify(body)});
function connected(){if(!getCurrentUser())throw new Error('Reconnect Google Drive to identify the user making immunization changes.');}
export async function immunizationWorkbook(knownIds=[],create=false){
 const unique=[...new Set(knownIds.filter(Boolean))];if(unique.length>1)throw new Error('People are linked to different immunization workbooks. Resolve the master spreadsheet before editing.');
 const epoch=getDriveSessionEpoch();if(sourceEpoch!==epoch)resetImmunizationSource();
 if(!source||unique[0]&&source.id!==unique[0]){const file=await findImmunizationWorkbook(unique[0],create);if(epoch!==getDriveSessionEpoch())throw new Error('Connection changed.');source=file;sourceEpoch=epoch;}
 const book=await immunizationSheetsRequest(id(source.id)+'?fields=spreadsheetId,properties(timeZone),sheets(properties(sheetId,title,gridProperties),developerMetadata),developerMetadata');
 if(!book.spreadsheetId)throw new Error('Google returned an invalid immunization workbook.');
 book.sheets??=[];
 // Row metadata must be searched explicitly; Sheet.developerMetadata does not
 // reliably include metadata attached to row dimensions.
 const found=await post(id(book.spreadsheetId)+'/developerMetadata:search',{dataFilters:[{developerMetadataLookup:{metadataKey:ROW_KEY,visibility:'DOCUMENT'}}]});
 for(const sheet of book.sheets)sheet.developerMetadata=(sheet.developerMetadata||[]).filter(meta=>meta.metadataKey!==ROW_KEY);
 for(const match of found.matchedDeveloperMetadata||[]){const meta=match.developerMetadata;if(meta?.metadataKey!==ROW_KEY)continue;const sheet=book.sheets.find(item=>item.properties.sheetId===meta.location?.dimensionRange?.sheetId);if(!sheet)throw new Error('A immunization row marker points to an unavailable sheet.');sheet.developerMetadata.push(meta);}
 return book;
}
function binding(sheet){return (sheet.developerMetadata||[]).filter(meta=>meta.metadataKey===PERSON_KEY&&meta.location?.sheetId===sheet.properties.sheetId);}
function findSheet(book,person){
 const matches=book.sheets.filter(sheet=>binding(sheet).some(meta=>meta.metadataValue===person.id));
 if(matches.length>1)throw new Error('Multiple immunization sheets are linked to this person. Resolve the duplicates before editing.');
 const link=person.immunizationSheet;
 if(link){if(link.spreadsheetId!==book.spreadsheetId)throw new Error('This person is linked to a different immunization workbook.');const sheet=book.sheets.find(item=>item.properties.sheetId===link.sheetId);if(!sheet||!matches.includes(sheet))throw new Error('The linked immunization sheet is missing or its person marker changed. Restore it before retrying.');return sheet;}
 return matches[0]||null;
}
function markers(sheet){const map=new Map();for(const meta of sheet.developerMetadata||[]){if(meta.metadataKey!==ROW_KEY)continue;if(meta.location?.dimensionRange?.sheetId!==sheet.properties.sheetId||meta.location.dimensionRange.dimension!=='ROWS'||meta.location.dimensionRange.endIndex-meta.location.dimensionRange.startIndex!==1)throw new Error('A immunization row marker is invalid.');if(map.has(meta.metadataValue))throw new Error('Duplicate immunization row markers found.');map.set(meta.metadataValue,meta.metadataId);}return map;}
const grid=sheetId=>({gridRange:{sheetId,startColumnIndex:0,endColumnIndex:IMMUNIZATION_FIELDS.length}});
const rowFilter=metadataId=>({developerMetadataLookup:{metadataId}});
async function getValues(bookId,filters){return post(id(bookId)+'/values:batchGetByDataFilter',{dataFilters:filters,majorDimension:'ROWS',valueRenderOption:'FORMATTED_VALUE'});}
function context(book,person,sheet,values){return {personId:person.id,spreadsheetId:book.spreadsheetId,sheetId:sheet.properties.sheetId,sheetTitle:sheet.properties.title,timezone:book.properties.timeZone,markers:markers(sheet),rows:parseImmunizationRows(values,markers(sheet)),missing:false};}
export async function readImmunizationList(person,knownIds=[]){
 let book;try{book=await immunizationWorkbook(knownIds);}catch(error){if(error.code==='IMMUNIZATION_WORKBOOK_MISSING'&&!person.immunizationSheet&&!knownIds.length)return {personId:person.id,rows:[],missing:true};throw error;}const sheet=findSheet(book,person);if(!sheet)return {personId:person.id,spreadsheetId:book.spreadsheetId,timezone:book.properties.timeZone,rows:[],missing:true};
 const response=await getValues(book.spreadsheetId,[grid(sheet.properties.sheetId)]);return context(book,person,sheet,response.valueRanges?.[0]?.valueRange?.values||[]);
}
const cell=value=>({userEnteredValue:{stringValue:String(value)}});
const cells=values=>({values:values.map(cell)});
export async function createImmunizationList(person,knownIds=[],timezone='America/New_York'){
 connected();const book=await immunizationWorkbook(knownIds,true),existing=findSheet(book,person);if(existing)return readImmunizationList(person,knownIds);
 new Intl.DateTimeFormat('en-US',{timeZone:timezone});
 const initialized=(book.developerMetadata||[]).some(meta=>meta.metadataKey===SCHEMA_KEY&&meta.metadataValue==='1');
 const requests=[];
 if(!initialized){
   const check=book.sheets.length?await getValues(book.spreadsheetId,book.sheets.map(sheet=>({gridRange:{sheetId:sheet.properties.sheetId}}))):{};
   if(check.valueRanges?.some(range=>range.valueRange?.values?.some(row=>row.some(value=>String(value).trim()))))throw new Error('The spreadsheet is not blank and is not initialized for BHR. Existing cells were left unchanged.');
   const first=book.sheets[0]||{properties:{sheetId:0}};if(!book.sheets.length)requests.push({addSheet:{properties:{sheetId:0,title:'Sheet1'}}});
   const readmeId=first.properties.sheetId;
   requests.push({updateSheetProperties:{properties:{sheetId:readmeId,title:'Read Me'},fields:'title'}},{updateSpreadsheetProperties:{properties:{timeZone:timezone},fields:'timeZone'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:SCHEMA_KEY,metadataValue:'1',visibility:'DOCUMENT',location:{spreadsheet:true}}}},{updateCells:{start:{sheetId:readmeId,rowIndex:0,columnIndex:0},rows:[cells(['BHR Immunizations']),cells(['Use BHR to add, edit or delete immunization entries.']),cells(['Keep column headings, hidden Entry IDs and row markers intact.']),cells(['Record vaccine name, administered date, dose/series, location, next due and optional additional details.']),cells(['Both dates may be partial. Enter MM/DD/YYYY, MM/YYYY or YYYY in BHR; cells store ISO dates preserving precision.']),cells(['Deleted entries leave blank rows to preserve stable targeting during concurrent edits.']),cells(['Use one row per administered dose. A blank date means unknown, not that a dose was not given.'])],fields:'userEnteredValue'}},{updateDimensionProperties:{range:{sheetId:readmeId,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{pixelSize:750},fields:'pixelSize'}});
 }
 const sheetId=medicationSheetId(person.id,[0,...book.sheets.map(sheet=>sheet.properties.sheetId)]),title=medicationSheetTitle(person,book.sheets.map(sheet=>sheet.properties.title));
 requests.push({addSheet:{properties:{sheetId,title,gridProperties:{rowCount:1000,columnCount:IMMUNIZATION_FIELDS.length,frozenRowCount:1}}}},{createDeveloperMetadata:{developerMetadata:{metadataKey:PERSON_KEY,metadataValue:person.id,visibility:'DOCUMENT',location:{sheetId}}}},{updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[cells(IMMUNIZATION_HEADERS)],fields:'userEnteredValue'}},{repeatCell:{range:{sheetId},cell:{userEnteredFormat:{textFormat:{fontFamily:'Arial',fontSize:10},wrapStrategy:'WRAP',numberFormat:{type:'TEXT'}}},fields:'userEnteredFormat'}},{repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:.8,green:.8,blue:.8},textFormat:{bold:true}}},fields:'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold'}});
 for(const index of [0,12,15,17])requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},properties:{hiddenByUser:true},fields:'hiddenByUser'}});
 try{await post(id(book.spreadsheetId)+':batchUpdate',{requests});}
 catch(error){const reread=await immunizationWorkbook(knownIds);if(!findSheet(reread,person))throw error;}
 return readImmunizationList(person,[book.spreadsheetId]);
}
async function freshRow(ctx,entry,allowDeleted=false){
 const book=await immunizationWorkbook([ctx.spreadsheetId]),sheet=findSheet(book,{id:ctx.personId,immunizationSheet:{spreadsheetId:ctx.spreadsheetId,sheetId:ctx.sheetId}});
 const marker=markers(sheet).get(entry.id);if(marker!==entry.metadataId){throw new Error('This immunization entry’s row marker changed. Refresh before editing.');}
 if(!Number.isInteger(entry.metadataId))throw new Error('The immunization entry has no stable row marker. Refresh the list.');
 const response=await getValues(ctx.spreadsheetId,[rowFilter(entry.metadataId)]),values=response.valueRanges?.[0]?.valueRange?.values?.[0]||[];
 if(!values.length||values.every(value=>!String(value).trim())){if(allowDeleted)return null;throw new Error('This immunization entry was deleted. Refresh the list.');}
 const actual=IMMUNIZATION_FIELDS.map((_,i)=>String(values[i]??''));
 if(actual[0]!==entry.id)throw new Error('The row marker and immunization entry ID no longer match. No entry was changed.');
 if(JSON.stringify(actual)!==JSON.stringify(entry.baseline))throw new Error('This immunization entry changed in the spreadsheet. Refresh and review it before saving.');return actual;
}
export async function addImmunization(ctx,entry){
 connected();const book=await immunizationWorkbook([ctx.spreadsheetId]),sheet=book.sheets.find(item=>item.properties.sheetId===ctx.sheetId);
 if(!sheet||!binding(sheet).some(meta=>meta.metadataValue===ctx.personId))throw new Error('The person’s sheet changed. Refresh before saving.');
 const fresh=await readImmunizationList({id:ctx.personId,immunizationSheet:{spreadsheetId:ctx.spreadsheetId,sheetId:ctx.sheetId}},[ctx.spreadsheetId]),old=fresh.rows.find(row=>row.id===entry.id);
 if(old){if(EDITABLE_IMMUNIZATION_FIELDS.every(key=>old[key]===entry[key]))return old;throw new Error('This entry ID already exists with different details. Refresh before editing it.');}
 if(fresh.markers.has(entry.id))throw new Error('This entry was removed. Start a new entry if needed.');
 await post(id(ctx.spreadsheetId)+':batchUpdate',{requests:[{insertDimension:{range:{sheetId:ctx.sheetId,dimension:'ROWS',startIndex:1,endIndex:2},inheritFromBefore:false}},{updateCells:{start:{sheetId:ctx.sheetId,rowIndex:1,columnIndex:0},rows:[cells(immunizationToRow(entry))],fields:'userEnteredValue'}},{repeatCell:{range:{sheetId:ctx.sheetId,startRowIndex:1,endRowIndex:2},cell:{userEnteredFormat:{textFormat:{bold:false,foregroundColor:{red:0,green:0,blue:0}},numberFormat:{type:'TEXT'}}},fields:'userEnteredFormat.textFormat,userEnteredFormat.numberFormat'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:ROW_KEY,metadataValue:entry.id,visibility:'DOCUMENT',location:{dimensionRange:{sheetId:ctx.sheetId,dimension:'ROWS',startIndex:1,endIndex:2}}}}}]});return entry;
}
export async function updateImmunization(ctx,before,after){
 connected();await freshRow(ctx,before);await freshRow(ctx,before);
 await post(id(ctx.spreadsheetId)+'/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:[{dataFilter:rowFilter(before.metadataId),majorDimension:'ROWS',values:[immunizationToRow(after)]}]});return after;
}
export async function deleteImmunization(ctx,entry){
 connected();if(!await freshRow(ctx,entry,true))return;await freshRow(ctx,entry);
 // Clear data through its stable metadata ID. Physically deleting a row by an
 // index could remove the wrong entry after another client inserts rows.
 await post(id(ctx.spreadsheetId)+'/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:[{dataFilter:rowFilter(entry.metadataId),majorDimension:'ROWS',values:[IMMUNIZATION_FIELDS.map(()=>'')]}]});
}

// One workbook read and one batched grid request for the master view.
export async function readAllImmunizationLists(people,knownIds=[]){
 let book;try{book=await immunizationWorkbook(knownIds);}catch(error){if(error.code==='IMMUNIZATION_WORKBOOK_MISSING'&&!knownIds.length)return people.map(person=>({personId:person.id,rows:[],missing:true}));throw error;}
 const matched=people.map(person=>({person,sheet:findSheet(book,person)})),sheets=matched.filter(item=>item.sheet);
 const result=sheets.length?await getValues(book.spreadsheetId,sheets.map(item=>grid(item.sheet.properties.sheetId))):{};
 const loaded=new Map(sheets.map((item,i)=>[item.person.id,context(book,item.person,item.sheet,result.valueRanges?.[i]?.valueRange?.values||[])]));
 return matched.map(({person})=>loaded.get(person.id)||{personId:person.id,rows:[],missing:true});
}
