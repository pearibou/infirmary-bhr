"""Synthetic Drive + Sheets backend. No real clinical data or Google writes."""
import copy,json,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import open_bhr,prepare_test_page,unlock_test_drive,ignore_event_log_projection
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
HEADERS=['Entry ID','Medication','Dose','Route','Frequency','Instructions','Indication','Prescriber','Start date','Status','Scheduled end','Discontinued date','Discontinuation reason','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Completion processed at','Revision']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'version':1,'people':[{'id':'person-a','name':'Synthetic John','firstName':'John','lastName':'Smith','preferredName':'Synthetic John','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]},{'id':'person-b','name':'Synthetic James','firstName':'James','lastName':'Smith','preferredName':'Synthetic James','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
    seed['people'].append({'id':'departed','name':'Synthetic Departed','preferredName':'Synthetic Departed','lastName':'Zulu','deceased':True,'deathDate':{'year':'2020'},'info':'','notes':[],'updatedAt':'2026-01-01T00:00:00Z'})
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
    directory=[seed];book={'spreadsheetId':'workbook','properties':{'timeZone':'Etc/UTC'},'sheets':[{'properties':{'sheetId':0,'title':'Sheet1','gridProperties':{'rowCount':1000,'columnCount':26}},'developerMetadata':[]}],'developerMetadata':[]};grids={0:[]};serial=[1];batches=[];lost_add=[False];fail_updates=[False];disabled_api=[False]
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
            assert body=={'dataFilters':[{'developerMetadataLookup':{'metadataKey':'bhr.medicationId','visibility':'DOCUMENT'}}]}
            route.fulfill(json={'matchedDeveloperMetadata':[{'developerMetadata':m} for tab in book['sheets'] for m in tab['developerMetadata'] if m['metadataKey']=='bhr.medicationId']});return
        if path.endswith('/values:batchGetByDataFilter'):
            ranges=[{'dataFilters':[f],'valueRange':{'values':filter_rows(f)}} for f in body['dataFilters']]
            route.fulfill(json={'valueRanges':list(reversed(ranges))});return
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
                        rows[index]=[cell.get('userEnteredValue',{}).get('stringValue','') for cell in row['values']]
            if is_add and lost_add[0]:lost_add[0]=False;route.fulfill(status=503,json={'error':{'message':'Synthetic save response lost'}});return
            route.fulfill(json={'replies':[{} for _ in body['requests']]});return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic Sheets route'}})
    def drive(route):
        req=route.request;url=urllib.parse.urlparse(req.url);params=urllib.parse.parse_qs(url.query)
        if '/userinfo' in url.path:route.fulfill(json={'sub':'synthetic-staff','name':'Synthetic Staff'});return
        if url.path.endswith('/root'):route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','appProperties':{'bhrWorkspace':'1'},'capabilities':{'canAddChildren':True}});return
        if url.path.endswith('/workbook'):route.fulfill(json={'id':'workbook','name':'Medication Lists (BHR)','mimeType':'application/vnd.google-apps.spreadsheet','parents':['root']});return
        if url.path.endswith('/staff-profile'):route.fulfill(json={'version':1,'issuer':'https://accounts.google.com','subject':'synthetic-staff','displayName':'Synthetic Staff'});return
        if url.path.endswith('/files') and req.method=='GET':
            q=params.get('q',[''])[0]
            if 'staff_profile_' in q:route.fulfill(json={'files':[{'id':'staff-profile'}]});return
            route.fulfill(json={'files':[{'id':'workbook','name':'Medication Lists (BHR)','mimeType':'application/vnd.google-apps.spreadsheet','parents':['root']}] if 'Medication Lists (BHR)' in q else [{'id':'directory'}] if 'people_directory.json' in q else []});return
        if url.path.endswith('/directory'):
            if req.method=='PATCH':directory[0]=req.post_data_json
            route.fulfill(json=directory[0] if req.method=='GET' else {'id':'directory'});return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic Drive route'}})
    page.route('https://www.googleapis.com/**',drive);ignore_event_log_projection(page);page.route('https://sheets.googleapis.com/**',sheets_api)
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page,open_records=False)
    page.wait_for_function("!document.querySelector('#logout-power').disabled")
    assert page.locator('#records-window').is_hidden()
    page.locator('#medications-icon').dblclick();assert page.locator('#medications-title').inner_text()=='Medications'
    assert page.locator('#med-person').input_value()=='' and page.locator('#med-controls').is_hidden()
    assert page.locator('#medications-icon img').evaluate('i=>i.complete&&i.naturalWidth>0')
    assert page.locator('#med-person option').evaluate_all('nodes=>nodes.map(n=>n.value)')==['','person-b','person-a','departed']
    assert page.locator('#med-person optgroup[label=Deceased] option').inner_text()=='Synthetic Departed (Deceased)'
    page.locator('#med-person').select_option('departed');page.get_by_role('button',name='+ Add medication list',exact=True).wait_for();assert len(book['sheets'])==1
    page.locator('#medications-dialog [data-close]').click();page.locator('#medications-icon').focus();page.keyboard.press('Enter');assert page.locator('#med-person').input_value()==''
    page.locator('#medications-dialog [data-close]').click();page.screenshot(path='/tmp/bhr-medications-desktop.png');page.locator('#medications-icon').screenshot(path='/tmp/bhr-medications-icon.png');page.locator('#medications-icon').dblclick()
    page.locator('#med-person').select_option('person-a');page.get_by_role('button',name='+ Add medication list',exact=True).wait_for()
    assert len(book['sheets'])==1 and grids[0]==[]
    page.locator('#medications-dialog [data-close]').click();open_bhr(page)
    page.locator('.person strong').filter(has_text='Synthetic John').click()
    nav=page.locator('.chart-navigation');assert nav.get_by_role('button').all_text_contents()==['Demographics','Vital Signs','Medications','Medical History']
    nav.get_by_role('button',name='Medications',exact=True).click();page.get_by_role('button',name='+ Add medication list',exact=True).wait_for()
    assert len(book['sheets'])==1 and grids[0]==[] and page.locator('#med-controls').is_hidden()
    grids[0]=[['Synthetic existing content']]
    page.get_by_role('button',name='+ Add medication list',exact=True).click();page.get_by_role('button',name='Retry',exact=True).wait_for()
    assert not batches and grids[0]==[['Synthetic existing content']] and len(book['sheets'])==1
    grids[0]=[];page.get_by_role('button',name='Retry',exact=True).click();page.get_by_role('button',name='+ Add medication list',exact=True).wait_for()
    page.get_by_role('button',name='+ Add medication list',exact=True).click();page.get_by_role('button',name='Add medication…',exact=True).wait_for(state='visible')
    page.wait_for_function("!document.querySelector('#med-add').disabled")
    sid=next(s['properties']['sheetId'] for s in book['sheets'] if s['properties']['title']=='Smith J')
    assert book['properties']['timeZone']=='America/New_York' and grids[sid][0]==HEADERS
    assert any('setDataValidation' in req for batch in batches for req in batch)
    assert page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people[0].medicationSheet")=={'spreadsheetId':'workbook','sheetId':sid}
    page.locator('#med-add').click();form=page.locator('#medication-form')
    form.get_by_label('Medication name',exact=True).fill('Synthetic tablet 10 mg');form.get_by_label('Dose',exact=True).fill('One synthetic tablet');form.get_by_label('Frequency',exact=True).fill('Daily');form.get_by_label('Indication',exact=True).fill('Synthetic indication');form.get_by_label('Prescriber',exact=True).fill('Synthetic clinician')
    lost_add[0]=True;page.locator('#med-form-save').click();page.wait_for_function("document.querySelector('#med-form-error').textContent.includes('lost')")
    assert form.get_by_label('Medication name',exact=True).input_value()=='Synthetic tablet 10 mg'
    assert len(entry_rows(sid))==1
    page.locator('#med-form-save').click();page.wait_for_function("!document.querySelector('#medication-form-dialog').open && !document.querySelector('#med-add').disabled")
    assert len(entry_rows(sid))==1
    card=page.locator('.med-entry').filter(has_text='Synthetic tablet 10 mg');assert 'Synthetic indication' in card.inner_text() and 'Synthetic clinician' in card.inner_text()
    assert 'Synthetic tablet 10 mg' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    def print_current(history=False):
        page.locator('#med-print-history').set_checked(history)
        print_routes=[];page.route('**/icons/icon-512.png',lambda route:print_routes.append(route))
        page.locator('#med-print').click();page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.body?.textContent.includes('Medication List')")
        page.evaluate("window.printCalls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>window.printCalls++")
        page.wait_for_timeout(100);assert print_routes;print_routes.pop().fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes())
        page.wait_for_function('window.printCalls===1');page.wait_for_function("!document.querySelector('#med-print').disabled")
        assert all(table.locator('thead tr').count()==1 for table in page.frame_locator('#bhr-print-frame').locator('table').all())
        result=page.frame_locator('#bhr-print-frame').locator('body').inner_text()
        preview=browser.new_page();preview.set_content(page.locator('#bhr-print-frame').evaluate('frame=>frame.contentDocument.documentElement.outerHTML'));preview.locator('img').evaluate('image=>image.decode()');preview.pdf(path='/tmp/bhr-medications-print.pdf',format='Letter');preview.close()
        page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))")
        page.unroute('**/icons/icon-512.png');return result
    assert page.locator('#med-add .diagnosis-plus').inner_text()=='+'
    for name,frequency in [('Zulu scheduled','Daily'),('Alpha as-needed','PRN'),('Beta as-needed','Q6H prn')]:
        page.locator('#med-add').click();form.get_by_label('Medication name',exact=True).fill(name);form.get_by_label('Frequency',exact=True).fill(frequency);page.locator('#med-form-save').click();page.wait_for_function("!document.querySelector('#medication-form-dialog').open && !document.querySelector('#med-add').disabled")
    assert page.locator('.med-entry h3').all_text_contents()==['Synthetic tablet 10 mg','Zulu scheduled','Alpha as-needed','Beta as-needed']
    assert page.locator('.med-prn').count()==2 and page.locator('.med-prn-divider').count()==1
    assert page.locator('.med-prn').first.evaluate('el=>getComputedStyle(el).backgroundColor')=='rgb(231, 240, 224)'
    print_body=print_current();assert print_body.index('Zulu scheduled')<print_body.index('Alpha as-needed')
    beta=page.locator('.med-entry').filter(has_text='Beta as-needed');beta.get_by_role('button',name='Edit…',exact=True).click();form.get_by_label('Frequency',exact=True).fill('Daily');page.locator('#med-form-save').click();page.wait_for_function("!document.querySelector('#medication-form-dialog').open && !document.querySelector('#med-add').disabled")
    assert page.locator('.med-entry h3').first.inner_text()=='Beta as-needed' and page.locator('.med-prn').count()==1
    for name in ['Zulu scheduled','Alpha as-needed','Beta as-needed']:
        page.locator('.med-entry').filter(has_text=name).get_by_role('button',name='Delete entry…',exact=True).click();page.locator('#med-action-confirm').click();page.wait_for_function("!document.querySelector('#medication-action-dialog').open && !document.querySelector('#med-add').disabled")
    print_body=print_current();assert 'Active medications' in print_body and 'Discontinued medications' not in print_body and 'Synthetic indication' in print_body and 'Last retrieved:' in print_body
    disabled_api[0]=True;page.locator('#med-print').click();page.wait_for_function("document.querySelector('#med-status').textContent.startsWith('Could not print:')");assert page.locator('#bhr-print-frame').count()==0;disabled_api[0]=False

    card.get_by_role('button',name='Edit…',exact=True).click();form.get_by_label('Dose',exact=True).fill('Changed dose')
    entry_rows(sid)[0][2]='Externally changed dose';page.locator('#med-form-save').click();page.wait_for_function("document.querySelector('#med-form-error').textContent.includes('changed')")
    assert form.get_by_label('Dose',exact=True).input_value()=='Changed dose'
    page.locator('#med-form-cancel').click();page.locator('#med-refresh').click();page.wait_for_function("!document.querySelector('#med-add').disabled")
    card.get_by_role('button',name='Edit…',exact=True).click();form.get_by_label('Dose',exact=True).fill('Changed dose');add_blank_row(sid)
    page.locator('#med-form-save').click();page.wait_for_function("!document.querySelector('#medication-form-dialog').open && !document.querySelector('#med-add').disabled")
    assert entry_rows(sid)[0][2]=='Changed dose'
    card.get_by_role('button',name='Discontinue…',exact=True).click();page.locator('#med-discontinue-reason').fill('Synthetic course stopped');page.locator('#med-action-confirm').click();page.wait_for_function("!document.querySelector('#medication-action-dialog').open && !document.querySelector('#med-add').disabled")
    page.locator('#med-discontinued').click();assert 'Synthetic course stopped' in page.locator('#med-content').inner_text()
    page.get_by_role('button',name='Delete entry…',exact=True).click();page.locator('#med-action-confirm').click();page.wait_for_function("!document.querySelector('#medication-action-dialog').open && !document.querySelector('#med-add').disabled")
    assert entry_rows(sid)==[]
    def add_course(name):
        page.locator('#med-add').click();form.get_by_label('Medication name',exact=True).fill(name);page.locator('#med-short-course').check();form.get_by_label('End date',exact=True).fill('2000-01-01');page.locator('#med-form-save').click();page.wait_for_function("!document.querySelector('#medication-form-dialog').open && !document.querySelector('#med-add').disabled")
    add_course('Synthetic completed course');row=next(row for row in entry_rows(sid) if row[1]=='Synthetic completed course');assert row[9]=='Discontinued' and row[12]=='Scheduled course completed' and row[19]
    fail_updates[0]=True;add_course('Synthetic pending course');assert 'Scheduled end passed—update pending' in page.locator('#med-content').inner_text()
    page.locator('#med-print').click();page.wait_for_function("document.querySelector('#med-status').textContent.includes('Printing stopped')");assert page.locator('#bhr-print-frame').count()==0
    fail_updates[0]=False;sheet(sid)['properties']['title']='Freely renamed tab';page.locator('#med-refresh').click();page.wait_for_function("!document.querySelector('#med-add').disabled")
    assert next(row for row in entry_rows(sid) if row[1]=='Synthetic pending course')[9]=='Discontinued' and len(book['sheets'])==2
    print_body=print_current(True);assert 'Discontinued medications' in print_body and 'Synthetic completed course' in print_body
    sheet(sid)['properties']['title']='Smith J'
    page.locator('#med-person').select_option('person-b');page.get_by_role('button',name='+ Add medication list',exact=True).click();page.wait_for_function("!document.querySelector('#med-add').disabled")
    assert any(s['properties']['title']=='Smith J (2)' for s in book['sheets'])
    page.locator('#medications-dialog [data-close]').click();disabled_api[0]=True;page.locator('.chart-navigation').get_by_role('button',name='Medications',exact=True).click();page.get_by_role('button',name='Retry',exact=True).wait_for();assert page.get_by_role('button',name='+ Add medication list',exact=True).count()==0
    disabled_api[0]=False;page.get_by_role('button',name='Retry',exact=True).click();page.wait_for_function("!document.querySelector('#med-add').disabled")
    page.locator('#medications-dialog [data-close]').click()
    startup=entry_rows(sid)[0];startup_id=startup[0];startup[9]='Active';startup[11]='';startup[12]='';startup[19]='';startup[20]=str(int(startup[20])+1)
    page.reload();page.wait_for_function("window.google?.accounts?.oauth2 && !document.querySelector('#drive-status').textContent.startsWith('Preparing')");page.locator('#google-connect').click()
    page.wait_for_function("!document.body.classList.contains('drive-locked') && !document.querySelector('#logout-power').disabled")
    assert next(row for row in entry_rows(sid) if row[0]==startup_id)[9]=='Discontinued'
    assert 'Medication startup check' not in page.locator('#toast').inner_text()
    # Genuine missing metadata still stops that person's check and identifies them.
    damaged=next(m for m in sheet(sid)['developerMetadata'] if m.get('metadataValue')==startup_id)
    snapshot=copy.deepcopy(grids[sid]);sheet(sid)['developerMetadata'].remove(damaged)
    page.reload();page.wait_for_function("window.google?.accounts?.oauth2 && !document.querySelector('#drive-status').textContent.startsWith('Preparing')");page.locator('#google-connect').click()
    page.wait_for_function("!document.body.classList.contains('drive-locked') && !document.querySelector('#logout-power').disabled")
    assert 'Synthetic John' in page.locator('#toast').inner_text() and 'Open this person' in page.locator('#toast').inner_text()
    assert grids[sid]==snapshot
    sheet(sid)['developerMetadata'].append(damaged)
    page.reload();page.wait_for_function("window.google?.accounts?.oauth2 && !document.querySelector('#drive-status').textContent.startsWith('Preparing')");page.locator('#google-connect').click()
    page.wait_for_function("!document.body.classList.contains('drive-locked') && !document.querySelector('#logout-power').disabled")

    page.locator('#drive-dialog [data-close]').click();open_bhr(page);page.locator('.chart-navigation').get_by_role('button',name='Medications',exact=True).click();page.wait_for_function("!document.querySelector('#med-add').disabled")
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#med-add').click();form.get_by_label('Medication name',exact=True).fill('Synthetic unsaved private medication');page.locator('#medication-form-dialog .window-control').click();page.locator('#medications-dialog [data-close]').click()
    page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert 'Synthetic' not in page.locator('body').text_content();assert form.get_by_label('Medication name',exact=True).input_value()==''
    assert page.evaluate("localStorage.getItem('infirmary.directory.v1')") is None
    assert not errors,errors
    browser.close()
print('PASS: chart navigation; on-demand template; stable link/row IDs; idempotent save; conflict protection; discontinue/delete; timezone course completion/pending retry; tab rename/collision; API failure; mobile; logout cleanup')
