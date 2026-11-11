"""Synthetic Drive + Sheets backend. No real clinical data or Google writes."""
import copy,json,urllib.parse,os
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,ignore_event_log_projection
# Selected public Google discovery schemas, including their transitive types.
SCHEMAS=json.loads(Path(__file__).with_name('sheets-request-schema.json').read_text())['schemas']
def validate_request(value,schema,path='request'):
    if '$ref' in schema:schema=SCHEMAS[schema['$ref']]
    kind=schema.get('type')
    if kind=='object':
        assert isinstance(value,dict),path
        for key,item in value.items():
            child=schema.get('properties',{}).get(key,schema.get('additionalProperties'))
            assert child is not None,f'Unknown Google Sheets field: {path}.{key}'
            validate_request(item,child,path+'.'+key)
    elif kind=='array':
        assert isinstance(value,list),path
        for item in value:validate_request(item,schema['items'],path+'[]')
    elif kind=='string':assert isinstance(value,str),path
    elif kind=='boolean':assert isinstance(value,bool),path
    elif kind in ['integer','number']:assert isinstance(value,(int,float)) and not isinstance(value,bool),path
    if 'enum' in schema:assert value in schema['enum'],path
try:
    validate_request({'addDeveloperMetadata':{}},SCHEMAS['Request'])
    raise AssertionError('Obsolete metadata request name was accepted')
except AssertionError as error:
    assert 'Unknown Google Sheets field' in str(error)
HEADERS=['Entry ID','ICD-10-CM code','Official title','Display name','Onset','Notes','Code edition','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Revision']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block',timezone_id='America/New_York');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'version':1,'people':[{'id':'person-a','name':'Synthetic John','firstName':'John','lastName':'Smith','preferredName':'Synthetic John','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]},{'id':'person-b','name':'Synthetic James','firstName':'James','lastName':'Smith','preferredName':'Synthetic James','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
    seed['people'].append({'id':'departed','name':'Synthetic Departed','preferredName':'Synthetic Departed','lastName':'Zulu','deceased':True,'deathDate':{'year':'2020'},'info':'','notes':[],'updatedAt':'2026-01-01T00:00:00Z'})
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
    directory=[seed];book={'spreadsheetId':'workbook','properties':{'timeZone':'Etc/UTC'},'sheets':[{'properties':{'sheetId':0,'title':'Sheet1','gridProperties':{'rowCount':1000,'columnCount':26}},'developerMetadata':[]}],'developerMetadata':[]};grids={0:[]};serial=[1];batches=[];lost_add=[False];fail_updates=[False];disabled_api=[False];workbook_exists=[False]
    if os.environ.get('VITALS_NONBLANK')=='1':workbook_exists[0]=True;grids[0]=[['Synthetic existing content']]
    if os.environ.get('VITALS_EMPTY_WORKBOOK')=='1':book['sheets']=[];grids={}
    def sheet(id):return next(item for item in book['sheets'] if item['properties']['sheetId']==id)
    def add_blank_row(sid,index=1):
        rows=grids[sid]
        while len(rows)<index:rows.append([])
        rows.insert(index,[])
        for meta in sheet(sid)['developerMetadata']:
            loc=meta['location'].get('dimensionRange')
            if loc and loc['startIndex']>=index:loc['startIndex']+=1;loc['endIndex']+=1
    def marker(mid):
        for s in book['sheets']:
            for meta in s['developerMetadata']:
                if meta['metadataId']==mid:return meta
        return None
    def filter_rows(f):
        if 'gridRange' in f:return copy.deepcopy(grids[f['gridRange']['sheetId']])
        meta=marker(f['developerMetadataLookup']['metadataId'])
        if not meta:return []
        loc=meta['location']['dimensionRange'];return [copy.deepcopy(grids[loc['sheetId']][loc['startIndex']])]
    def entry_rows(sid):return [row for row in grids[sid][1:] if row and row[0]]
    def sheets_api(route):
        req=route.request;path=urllib.parse.urlparse(req.url).path;body=req.post_data_json if req.method=='POST' else None
        if disabled_api[0]:route.fulfill(status=403,json={'error':{'message':'Google Sheets API is disabled'}});return
        if path.endswith('/workbook'):
            response=copy.deepcopy(book)
            for tab in response['sheets']:tab['developerMetadata']=[m for m in tab['developerMetadata'] if 'dimensionRange' not in m['location']]
            route.fulfill(json=response);return
        if path.endswith('/developerMetadata:search'):
            assert body=={'dataFilters':[{'developerMetadataLookup':{'metadataKey':'bhr.vitals.entryId','visibility':'DOCUMENT'}}]}
            route.fulfill(json={'matchedDeveloperMetadata':[{'developerMetadata':m} for tab in book['sheets'] for m in tab['developerMetadata'] if m['metadataKey']=='bhr.vitals.entryId']});return
        if path.endswith('/values:batchGetByDataFilter'):
            route.fulfill(json={'valueRanges':[{'dataFilters':[f],'valueRange':{'values':filter_rows(f)}} for f in body['dataFilters']]});return
        if path.endswith('/values:batchUpdateByDataFilter'):
            if fail_updates[0]:route.fulfill(status=503,json={'error':{'message':'Synthetic update failed'}});return
            for change in body['data']:
                assert body['valueInputOption']=='RAW'
                meta=marker(change['dataFilter']['developerMetadataLookup']['metadataId']);loc=meta['location']['dimensionRange'];grids[loc['sheetId']][loc['startIndex']]=change['values'][0]
            route.fulfill(json={'totalUpdatedRows':len(body['data'])});return
        if path.endswith('/workbook:batchUpdate'):
            for request in body['requests']:validate_request(request,SCHEMAS['Request'])
            batches.append(body['requests']);is_add=any('insertDimension' in item for item in body['requests'])
            for request in body['requests']:
                if 'addSheet' in request:
                    props=request['addSheet']['properties'];assert all(s['properties']['sheetId']!=props['sheetId'] for s in book['sheets']);book['sheets'].append({'properties':props,'developerMetadata':[]});grids[props['sheetId']]=[]
                elif 'updateSheetProperties' in request:
                    props=request['updateSheetProperties']['properties'];sheet(props['sheetId'])['properties'].update(props)
                elif 'updateSpreadsheetProperties' in request:book['properties'].update(request['updateSpreadsheetProperties']['properties'])
                elif 'createDeveloperMetadata' in request:
                    meta=copy.deepcopy(request['createDeveloperMetadata']['developerMetadata']);meta['metadataId']=serial[0];serial[0]+=1;loc=meta['location']
                    if loc.get('spreadsheet'):book['developerMetadata'].append(meta)
                    else:sheet(loc.get('sheetId',loc.get('dimensionRange',{}).get('sheetId')))['developerMetadata'].append(meta)
                elif 'insertDimension' in request:
                    r=request['insertDimension']['range'];add_blank_row(r['sheetId'],r['startIndex'])
                elif 'updateCells' in request:
                    change=request['updateCells'];start=change['start'];rows=grids[start['sheetId']]
                    for i,row in enumerate(change['rows']):
                        index=start['rowIndex']+i
                        while len(rows)<=index:rows.append([])
                        start_col=start.get('columnIndex',0);values=[cell.get('userEnteredValue',{}).get('stringValue','') for cell in row['values']]
                        while len(rows[index])<start_col+len(values):rows[index].append('')
                        rows[index][start_col:start_col+len(values)]=values
            if is_add and lost_add[0]:lost_add[0]=False;route.fulfill(status=503,json={'error':{'message':'Synthetic save response lost'}});return
            route.fulfill(json={'replies':[{} for _ in body['requests']]});return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic Sheets route'}})
    def drive(route):
        req=route.request;url=urllib.parse.urlparse(req.url);params=urllib.parse.parse_qs(url.query)
        if '/userinfo' in url.path:route.fulfill(json={'sub':'synthetic-staff','name':'Synthetic Staff'});return
        if url.path.endswith('/root'):route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','appProperties':{'bhrWorkspace':'1'},'capabilities':{'canAddChildren':True}});return
        if url.path.endswith('/workbook'):route.fulfill(json={'id':'workbook','name':'Vital Signs (BHR)','mimeType':'application/vnd.google-apps.spreadsheet','parents':['root']});return
        if url.path.endswith('/files') and req.method=='POST':
            assert req.post_data_json['name']=='Vital Signs (BHR)' and req.post_data_json['parents']==['root'];workbook_exists[0]=True;route.fulfill(json={'id':'workbook','name':'Vital Signs (BHR)'});return
        if url.path.endswith('/files') and req.method=='GET':
            q=params.get('q',[''])[0]
            route.fulfill(json={'files':[{'id':'workbook','name':'Vital Signs (BHR)','mimeType':'application/vnd.google-apps.spreadsheet','parents':['root']}] if 'Vital Signs (BHR)' in q and workbook_exists[0] else [{'id':'directory'}] if 'people_directory.json' in q else []});return
        if url.path.endswith('/directory'):
            if req.method=='PATCH':directory[0]=req.post_data_json
            route.fulfill(json=directory[0] if req.method=='GET' else {'id':'directory'});return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic Drive route'}})
    page.route('https://www.googleapis.com/**',drive);ignore_event_log_projection(page);page.route('https://sheets.googleapis.com/**',sheets_api)
    page.clock.set_fixed_time(datetime(2026,11,9,17,tzinfo=timezone.utc))
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page,open_records=False)
    assert page.locator('#records-window').is_hidden()
    icon=page.locator('#vitals-icon');assert icon.locator('img').evaluate('i=>i.complete&&i.naturalWidth>0');assert icon.bounding_box()['y']>page.locator('#bhr-icon').bounding_box()['y']
    icon.dblclick();assert page.locator('#vitals-trends').is_disabled()
    page.locator('#vitals-person').select_option('person-a');page.wait_for_function("!document.querySelector('#vitals-add').disabled")
    def add(values):
        page.locator('#vitals-add').click();form=page.locator('#vitals-form')
        for label,value in values.items():form.get_by_label(label,exact=True).fill(value)
        page.locator('#vitals-save').click();page.wait_for_function("!document.querySelector('#vitals-form-dialog').open && !document.querySelector('#vitals-add').disabled")
    add({'Measurement date and time':'2026-11-01T09:00','Pulse · bpm':'72','Systolic':'120','Diastolic':'80','Weight':'154.3','Temperature':'98.6'})
    add({'Measurement date and time':'2026-11-03T09:00','Pulse · bpm':'80','Systolic':'130','Diastolic':'85'})
    before=copy.deepcopy(grids);before_batches=len(batches)
    bar=page.locator('#vitals-dialog .vitals-actions').first.bounding_box();button=page.locator('#vitals-trends').bounding_box();assert button['x']>page.locator('#vitals-refresh').bounding_box()['x']
    page.locator('#vitals-trends').click();assert page.locator('#vital-trends-title').inner_text()=='Vital-sign trends — Synthetic John'
    assert page.locator('#vital-trends-graph circle').count()==2 and page.locator('#vital-trends-graph polyline').count()==1
    page.locator('#vital-trends-graph circle').first.click();assert '72 bpm' in page.locator('#vital-trends-point').inner_text()
    def date(id,value):
        page.locator(id).fill(value);page.locator(id).dispatch_event('change')
    date('#vital-trends-from','2026-11-03');date('#vital-trends-to','2026-11-03');assert page.locator('#vital-trends-graph circle').count()==1 and page.locator('#vital-trends-graph polyline').count()==0
    date('#vital-trends-from','2026-11-04');assert 'Start date' in page.locator('#vital-trends-status').inner_text() and page.locator('#vital-trends-print').is_disabled()
    page.locator('#vital-trends-preset').select_option('0');page.locator('#vital-trends-type').select_option('bloodPressure');assert page.locator('#vital-trends-graph circle').count()==4 and page.locator('#vital-trends-graph polyline').count()==2
    page.locator('#vital-trends-type').select_option('weight');page.locator('#vital-trends-units').select_option('kg');page.locator('#vital-trends-graph circle').click();assert '69.99 kg' in page.locator('#vital-trends-point').inner_text()
    page.locator('#vital-trends-type').select_option('oxygenSaturation');assert page.locator('#vital-trends-print').is_disabled() and 'No oxygen' in page.locator('#vital-trends-status').inner_text()
    page.locator('#vital-trends-type').select_option('pulse');page.locator('#vital-trends-dialog').screenshot(path='/tmp/bhr-vital-trends.png')
    # Pause only the print logo so we can capture the standard browser print invocation.
    pending=[];page.route('**/icons/icon-512.png',lambda route:pending.append(route));page.locator('#vital-trends-print').click()
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.querySelector('svg')")
    page.evaluate("()=>{window.printCalls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>{window.printCalls++};}")
    page.wait_for_timeout(100);pending.pop().fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes());page.wait_for_function('window.printCalls===1')
    frame=page.frame_locator('#bhr-print-frame');assert frame.locator('svg circle').count()==2 and 'John Smith' in frame.locator('body').inner_text()
    preview=browser.new_page();preview.set_content(page.locator('#bhr-print-frame').evaluate('frame=>frame.contentDocument.documentElement.outerHTML'));preview.pdf(path='/tmp/bhr-vital-trends.pdf',format='Letter');preview.close()
    import subprocess
    assert 'Pages:           1' in subprocess.check_output(['pdfinfo','/tmp/bhr-vital-trends.pdf'],text=True)
    page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");page.unroute('**/icons/icon-512.png')
    assert grids==before and len(batches)==before_batches
    page.locator('#vital-trends-dialog [data-close]').click();assert page.locator('#vital-trends-graph').text_content()==''
    page.locator('#vitals-person').select_option('person-b');page.wait_for_function("!document.querySelector('#vitals-add').disabled");page.locator('#vitals-trends').click();assert 'Synthetic James' in page.locator('#vital-trends-title').inner_text() and page.locator('#vital-trends-print').is_disabled()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    # Minimized graphs remain session-only and are erased by logout.
    page.locator('#vital-trends-dialog .window-control').click();page.locator('#vitals-dialog [data-close]').click();page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.locator('#vital-trends-graph').text_content()=='' and page.locator('#vital-trends-point').text_content()=='' and page.locator('#window-dock [data-window=vital-trends-dialog]').count()==0
    assert not errors,errors
    browser.close()
print('PASS: read-only charts, date filters, BP series, conversion, missing/single values, point details, Letter printing, patient isolation, mobile and logout cleanup')
