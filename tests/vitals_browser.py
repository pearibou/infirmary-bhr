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
    icon.dblclick();assert page.locator('#records-window').is_hidden();assert page.locator('#vitals-person').input_value()==''
    assert page.locator('#vitals-person optgroup[label="Deceased"] option').inner_text()=='Synthetic Departed (Deceased)'
    page.locator('#vitals-person').select_option('person-a');page.wait_for_function("!document.querySelector('#vitals-add').disabled")
    assert not batches and len(book['sheets'])<=1
    page.locator('#vitals-add').click();form=page.locator('#vitals-form');assert form.get_by_label('Oxygen delivery method (optional)',exact=True).input_value()=='RA'
    page.locator('#vitals-cancel').click();assert not batches
    page.locator('#vitals-add').click();page.locator('#vitals-save').click();assert 'at least one' in page.locator('#vitals-form-error').inner_text()
    for label,value in [('Measurement date and time','2026-11-01T09:00'),('Systolic','120'),('Diastolic','80'),('Pulse · bpm','72'),('Respirations · /min','16'),('Temperature','98.6'),('Oxygen saturation · %','98'),('Height','70'),('Weight','180'),('Comment (optional)','SYNTHETIC PRIVATE VITAL COMMENT')]:form.get_by_label(label,exact=True).fill(value)
    if os.environ.get('VITALS_NONBLANK')=='1':
        page.locator('#vitals-save').click();page.wait_for_function("document.querySelector('#vitals-form-error').textContent.includes('not blank')");assert not batches and grids[0]==[['Synthetic existing content']];grids[0]=[]
    lost_add[0]=True;page.locator('#vitals-save').click();page.wait_for_function("document.querySelector('#vitals-form-error').textContent.includes('lost')")
    assert form.get_by_label('Comment (optional)',exact=True).input_value()=='SYNTHETIC PRIVATE VITAL COMMENT'
    sid=next(tab['properties']['sheetId'] for tab in book['sheets'] if tab['properties']['title']=='Smith J');assert len(entry_rows(sid))==1
    page.locator('#vitals-save').click();page.wait_for_function("!document.querySelector('#vitals-form-dialog').open && !document.querySelector('#vitals-add').disabled")
    assert len(entry_rows(sid))==1 and workbook_exists[0] and len(grids[sid][0])==25
    first=copy.deepcopy(entry_rows(sid)[0]);assert first[1]=='2026-11-01T14:00:00.000Z' and first[9]=='RA'
    assert page.locator('#records-window').is_hidden() and '98% · RA' in page.locator('#vitals-content').inner_text()
    directory_value=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1'))");assert directory_value['people'][0]['vitalsSheet']=={'spreadsheetId':'workbook','sheetId':sid} and 'SYNTHETIC PRIVATE VITAL COMMENT' not in json.dumps(directory_value)
    assert page.locator('.vitals-map').first.inner_text()=='Estimated MAP ≈ 93 mmHg'
    page.locator('#vitals-dialog').screenshot(path='/tmp/bhr-vitals-window.png')
    page.locator('#vitals-dialog [data-close]').click();page.locator('#bhr-icon').dblclick();page.locator('.person strong').filter(has_text='Synthetic John').click()
    summary=page.locator('.person-vitals-summary');assert summary.is_visible() and '5′ 10″' in summary.inner_text() and '180 lb' in summary.inner_text()
    page.locator('#records-window').screenshot(path='/tmp/bhr-person-latest-vitals.png')
    page.locator('.chart-navigation').get_by_role('button',name='Vital Signs',exact=True).click();assert page.locator('#vitals-person').input_value()=='person-a'
    def add(values):
        page.wait_for_function("!document.querySelector('#vitals-add').disabled");page.locator('#vitals-add').click()
        for label,value in values.items():form.get_by_label(label,exact=True).fill(value)
        page.locator('#vitals-save').click();page.wait_for_function("!document.querySelector('#vitals-form-dialog').open && !document.querySelector('#vitals-add').disabled")
    add({'Measurement date and time':'2026-11-09T12:00','Pulse · bpm':'75'})
    assert page.locator('.vitals-entry').first.locator('time').get_attribute('datetime')=='2026-11-09T17:00:00.000Z'
    assert '180 lb' in summary.inner_text() and '5′ 10″' in summary.inner_text()
    page.locator('#vitals-add').click();form.get_by_label('Measurement date and time',exact=True).fill('2026-11-05T12:00');form.get_by_label('Weight',exact=True).fill('82');form.get_by_label('Weight unit',exact=True).select_option('kg');page.locator('#vitals-save').click();page.wait_for_function("!document.querySelector('#vitals-form-dialog').open && !document.querySelector('#vitals-add').disabled")
    assert '82 kg' in summary.inner_text() and summary.locator('time').last.get_attribute('datetime')=='2026-11-05T17:00:00.000Z'
    add({'Measurement date and time':'2026-10-01T12:00','Height':'68'})
    assert '5′ 10″' in summary.inner_text() and len(entry_rows(sid))==4
    weight_card=page.locator('.vitals-entry').filter(has_text='82 kg');weight_card.get_by_role('button',name='Edit…',exact=True).click();form.get_by_label('Weight',exact=True).fill('83.5');fail_updates[0]=True;page.locator('#vitals-save').click();page.wait_for_function("document.querySelector('#vitals-form-error').textContent.includes('failed')");assert form.get_by_label('Weight',exact=True).input_value()=='83.5'
    fail_updates[0]=False;page.locator('#vitals-save').click();page.wait_for_function("!document.querySelector('#vitals-form-dialog').open && !document.querySelector('#vitals-add').disabled");assert '83.5 kg' in summary.inner_text()
    page.locator('.vitals-entry').filter(has_text='83.5 kg').get_by_role('button',name='Edit…',exact=True).click();raw=next(row for row in entry_rows(sid) if row[12]=='83.5');raw[12]='85';form.get_by_label('Weight',exact=True).fill('84');page.locator('#vitals-save').click();page.wait_for_function("document.querySelector('#vitals-form-error').textContent.includes('changed in the spreadsheet')");assert raw[12]=='85';page.locator('#vitals-cancel').click()
    sheet(sid)['properties']['title']='Synthetic renamed vitals';page.locator('#vitals-refresh').click();page.wait_for_function("!document.querySelector('#vitals-refresh').disabled");assert '85 kg' in summary.inner_text()
    weight_card=page.locator('.vitals-entry').filter(has_text='85 kg');weight_card.get_by_role('button',name='Delete entry…',exact=True).click();page.locator('#vitals-delete-dialog [data-close]').click();assert len(entry_rows(sid))==4
    weight_card.get_by_role('button',name='Delete entry…',exact=True).click();page.locator('#vitals-delete-confirm').click();page.wait_for_function("!document.querySelector('#vitals-delete-dialog').open && !document.querySelector('#vitals-add').disabled");assert len(entry_rows(sid))==3 and '180 lb' in summary.inner_text()
    sheet(sid)['properties']['title']='Smith J'
    page.locator('#vitals-person').select_option('person-b');page.wait_for_function("!document.querySelector('#vitals-add').disabled");assert 'No vital signs recorded.' in page.locator('#vitals-content').inner_text() and len(book['sheets'])==2
    page.locator('#vitals-add').click();form.get_by_label('Height',exact=True).fill('165');form.get_by_label('Height unit',exact=True).select_option('cm');form.get_by_label('Oxygen saturation · %',exact=True).fill('96');form.get_by_label('Oxygen delivery method (optional)',exact=True).fill('NC 2 L/min');page.locator('#vitals-save').click();page.wait_for_function("!document.querySelector('#vitals-form-dialog').open && !document.querySelector('#vitals-add').disabled")
    assert any(tab['properties']['title']=='Smith J (2)' for tab in book['sheets']) and len(book['sheets'])==3
    assert '96% · NC 2 L/min' in page.locator('#vitals-content').inner_text() and 'SYNTHETIC PRIVATE VITAL COMMENT' not in page.locator('#vitals-content').inner_text() and '5′ 10″' in summary.inner_text()
    # Simulate an existing 22-column patient tab and verify append-only GCS upgrade.
    sid_b=next(tab['properties']['sheetId'] for tab in book['sheets'] if tab['properties']['title']=='Smith J (2)')
    grids[sid_b]=[row[:22] for row in grids[sid_b]];sheet(sid_b)['properties']['gridProperties']['columnCount']=22
    old_b=copy.deepcopy(entry_rows(sid_b)[0]);assert 'GCS' not in page.locator('#vitals-content').inner_text()
    page.locator('#vitals-add').click()
    page.locator('[data-gcs-field="gcsEye"][data-gcs-value="4"]').click();page.locator('#vitals-save').click();assert 'all three' in page.locator('#vitals-form-error').inner_text()
    for field,value in [('gcsVerbal','5'),('gcsMotor','6')]:page.locator(f'[data-gcs-field="{field}"][data-gcs-value="{value}"]').click()
    assert page.locator('#gcs-score').inner_text()=='15 / 15'
    page.locator('[data-gcs-field="gcsEye"][data-gcs-value="3"]').click()
    assert page.locator('[data-gcs-field="gcsEye"][aria-pressed="true"]').count()==1 and page.locator('#gcs-score').inner_text()=='14 / 15'
    page.locator('#vitals-form-dialog').screenshot(path='/tmp/bhr-gcs-form.png')
    page.locator('#vitals-save').click();page.wait_for_function("!document.querySelector('#vitals-form-dialog').open && !document.querySelector('#vitals-add').disabled")
    assert '14/15 · E3 V5 M6' in page.locator('#vitals-content').inner_text()
    assert entry_rows(sid_b)[-1][:22]==old_b and grids[sid_b][0][22:25]==['GCS Eye','GCS Verbal','GCS Motor']
    # Hidden inputs retain assigned values across form.reset(); new entries must explicitly clear GCS.
    for target in ['person-b','person-a']:
        page.locator('#vitals-person').select_option(target);page.wait_for_function("!document.querySelector('#vitals-add').disabled")
        page.locator('#vitals-add').click()
        assert page.locator('[data-gcs-field][aria-pressed="true"]').count()==0 and page.locator('#gcs-score').inner_text()=='— / 15'
        assert form.evaluate("f=>['gcsEye','gcsVerbal','gcsMotor'].every(k=>f.elements[k].value==='' && f.elements[k].defaultValue==='')")
        page.locator('#vitals-cancel').click()
    page.locator('#vitals-person').select_option('person-b');page.wait_for_function("!document.querySelector('#vitals-add').disabled")

    page.locator('.vitals-entry').filter(has_text='14/15').get_by_role('button',name='Edit…',exact=True).click()
    assert page.locator('#gcs-score').inner_text()=='14 / 15'
    page.locator('#gcs-clear').click();form.get_by_label('Pulse · bpm',exact=True).fill('77');page.locator('#vitals-save').click();page.wait_for_function("!document.querySelector('#vitals-form-dialog').open && !document.querySelector('#vitals-add').disabled")
    assert 'GCS' not in page.locator('#vitals-content').inner_text()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.locator('#vitals-add').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');form.get_by_label('Pulse · bpm',exact=True).fill('90');page.locator('#vitals-form-dialog').screenshot(path='/tmp/bhr-vitals-form-mobile.png');page.locator('#vitals-form-dialog .window-control').click();page.locator('#vitals-person').select_option('person-a');assert page.locator('#vitals-form-dialog').is_visible() and form.get_by_label('Pulse · bpm',exact=True).input_value()=='90';page.locator('#vitals-cancel').click();page.set_viewport_size({'width':1440,'height':1000})
    disabled_api[0]=True;page.locator('#vitals-refresh').click();page.wait_for_function("document.querySelector('#vitals-status').textContent.includes('unavailable')");assert 'No vital signs recorded.' not in page.locator('#vitals-content').inner_text();disabled_api[0]=False;page.locator('#vitals-content').get_by_role('button',name='Retry',exact=True).click();page.wait_for_function("!document.querySelector('#vitals-add').disabled")
    page.locator('#vitals-add').click();form.get_by_label('Comment (optional)',exact=True).fill('SYNTHETIC UNSAVED VITAL DRAFT');page.locator('#vitals-form-dialog .window-control').click();page.locator('#vitals-dialog [data-close]').click();page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.locator('#vitals-content').text_content()=='' and page.locator('#vitals-person').text_content()=='' and form.get_by_label('Comment (optional)',exact=True).input_value()=='' and page.locator('.person-vitals-summary').count()==0
    assert 'SYNTHETIC PRIVATE VITAL COMMENT' not in page.locator('body').text_content() and 'SYNTHETIC UNSAVED VITAL DRAFT' not in page.locator('body').text_content()
    assert len(entry_rows(sid))==3 and not errors,errors
    browser.close()
print('PASS: standalone desktop picker; chart access; on-demand workbook/tabs; RA/units; UTC measurement times; lost-save retry; newest-first history; independent latest height/weight; backdating; edit/conflict/delete fallback; tab rename/name collisions; patient isolation; mobile/drafts; API errors; private storage; logout')
