"""Synthetic Drive + Sheets backend. No real clinical data or Google writes."""
import copy,json,urllib.parse,os
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
HEADERS=['Entry ID','Vaccine','Date administered','Dose / series','Administered by / location','Next dose due','Comments','Lot number','Manufacturer','Route','Injection site','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Revision']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'version':1,'people':[{'id':'person-a','name':'Synthetic John','firstName':'John','lastName':'Smith','preferredName':'Synthetic John','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]},{'id':'person-b','name':'Synthetic James','firstName':'James','lastName':'Smith','preferredName':'Synthetic James','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
    seed['people'].append({'id':'departed','name':'Synthetic Departed','lastName':'Zulu','deceased':True,'info':'','notes':[],'updatedAt':'2026-01-01T00:00:00Z'})
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
    directory=[seed];book={'spreadsheetId':'workbook','properties':{'timeZone':'Etc/UTC'},'sheets':[{'properties':{'sheetId':0,'title':'Sheet1','gridProperties':{'rowCount':1000,'columnCount':26}},'developerMetadata':[]}],'developerMetadata':[]};grids={0:[]};serial=[1];batches=[];lost_add=[False];fail_updates=[False];disabled_api=[False];workbook_exists=[False]
    if os.environ.get('IMMUNIZATION_NONBLANK')=='1':workbook_exists[0]=True;grids[0]=[['Synthetic existing content']]
    if os.environ.get('IMMUNIZATION_EMPTY_WORKBOOK')=='1':book['sheets']=[];grids={}
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
            assert body=={'dataFilters':[{'developerMetadataLookup':{'metadataKey':'bhr.immunization.entryId','visibility':'DOCUMENT'}}]}
            route.fulfill(json={'matchedDeveloperMetadata':[{'developerMetadata':m} for tab in book['sheets'] for m in tab['developerMetadata'] if m['metadataKey']=='bhr.immunization.entryId']});return
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
                        rows[index]=[cell.get('userEnteredValue',{}).get('stringValue','') for cell in row['values']]
            if is_add and lost_add[0]:lost_add[0]=False;route.fulfill(status=503,json={'error':{'message':'Synthetic save response lost'}});return
            route.fulfill(json={'replies':[{} for _ in body['requests']]});return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic Sheets route'}})
    def drive(route):
        req=route.request;url=urllib.parse.urlparse(req.url);params=urllib.parse.parse_qs(url.query)
        if '/userinfo' in url.path:route.fulfill(json={'sub':'synthetic-staff','name':'Synthetic Staff'});return
        if url.path.endswith('/root'):route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','appProperties':{'bhrWorkspace':'1'},'capabilities':{'canAddChildren':True}});return
        if url.path.endswith('/workbook'):route.fulfill(json={'id':'workbook','name':'Immunizations (BHR)','mimeType':'application/vnd.google-apps.spreadsheet','parents':['root']});return
        if url.path.endswith('/files') and req.method=='POST':
            assert req.post_data_json['name']=='Immunizations (BHR)' and req.post_data_json['parents']==['root'];workbook_exists[0]=True;route.fulfill(json={'id':'workbook','name':'Immunizations (BHR)'});return
        if url.path.endswith('/files') and req.method=='GET':
            q=params.get('q',[''])[0]
            route.fulfill(json={'files':[{'id':'workbook','name':'Immunizations (BHR)','mimeType':'application/vnd.google-apps.spreadsheet','parents':['root']}] if 'Immunizations (BHR)' in q and workbook_exists[0] else [{'id':'directory'}] if 'people_directory.json' in q else []});return
        if url.path.endswith('/directory'):
            if req.method=='PATCH':directory[0]=req.post_data_json
            route.fulfill(json=directory[0] if req.method=='GET' else {'id':'directory'});return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic Drive route'}})
    page.route('https://www.googleapis.com/**',drive);ignore_event_log_projection(page);page.route('https://sheets.googleapis.com/**',sheets_api)
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    page.locator('#detail').get_by_role('button',name='Immunizations',exact=True).click()
    page.wait_for_function("!document.querySelector('#immunizations-add').disabled")
    assert not batches
    if os.environ.get('IMMUNIZATION_NONBLANK')!='1':assert not workbook_exists[0]
    page.locator('#immunizations-add').click();form=page.locator('#immunization-form')
    assert form.get_by_label('Vaccine / immunization name').input_value()==''
    form.get_by_label('Vaccine / immunization name').fill('Synthetic vaccine');form.get_by_label('Date administered',exact=True).fill('02/2020');form.get_by_label('Next dose due',exact=True).fill('01/2027');form.get_by_label('Dose / series number').fill('1')
    form.locator('summary').click();form.get_by_label('Lot number').fill('000123');form.get_by_label('Manufacturer').fill('Synthetic manufacturer')
    form.get_by_role('button',name='Save immunization',exact=True).click()
    if os.environ.get('IMMUNIZATION_NONBLANK')=='1':
        page.wait_for_function("document.querySelector('#immunization-form-error').textContent.includes('not blank')")
        assert not batches and grids[0]==[['Synthetic existing content']]
        grids[0]=[];form.get_by_role('button',name='Save immunization',exact=True).click()
    page.wait_for_function("!document.querySelector('#immunization-form-dialog').open && !document.querySelector('#immunizations-add').disabled")
    assert workbook_exists[0] and len(book['sheets'])==2
    sid=next(tab['properties']['sheetId'] for tab in book['sheets'] if tab['properties']['title']=='Smith J')
    assert grids[sid][0]==HEADERS and entry_rows(sid)[0][7]=='000123'
    assert 'Synthetic vaccine' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    assert entry_rows(sid)[0][2]=='2020-02' and entry_rows(sid)[0][5]=='2027-01'
    page.locator('.immunization-entry').first.get_by_role('button',name='Edit…',exact=True).click()
    assert form.get_by_label('Date administered',exact=True).input_value()=='02/2020' and form.get_by_label('Next dose due',exact=True).input_value()=='01/2027'
    form.get_by_label('Comments',exact=True).fill('Synthetic date preservation check');form.get_by_role('button',name='Save immunization',exact=True).click()
    page.wait_for_function("!document.querySelector('#immunization-form-dialog').open && !document.querySelector('#immunizations-add').disabled")
    assert entry_rows(sid)[0][2]=='2020-02' and entry_rows(sid)[0][5]=='2027-01'
    # Retried create is idempotent, despite a response lost after Google committed it.
    page.locator('#immunizations-add').click();form.get_by_label('Vaccine / immunization name').fill('Synthetic vaccine');form.get_by_label('Date administered',exact=True).fill('05/01/2024');form.get_by_label('Dose / series number').fill('2');form.get_by_label('Next dose due',exact=True).fill('03/2028');lost_add[0]=True
    form.get_by_role('button',name='Save immunization',exact=True).click();page.wait_for_function("document.querySelector('#immunization-form-error').textContent.includes('lost')")
    assert len(entry_rows(sid))==2
    form.get_by_role('button',name='Save immunization',exact=True).click();page.wait_for_function("!document.querySelector('#immunization-form-dialog').open && !document.querySelector('#immunizations-add').disabled")
    assert len(entry_rows(sid))==2
    card=page.locator('.immunization-entry').first;assert '05/01/2024' in card.inner_text()
    card.get_by_role('button',name='Edit…',exact=True).click();form.get_by_label('Date administered',exact=True).fill('02/29/2021');form.get_by_role('button',name='Save immunization',exact=True).click();assert 'Date administered must' in page.locator('#immunization-form-error').inner_text()
    form.get_by_label('Date administered',exact=True).fill('2025');entry_rows(sid)[0][6]='Externally changed';form.get_by_role('button',name='Save immunization',exact=True).click();page.wait_for_function("document.querySelector('#immunization-form-error').textContent.includes('changed')")
    assert form.get_by_label('Date administered',exact=True).input_value()=='2025'
    page.locator('#immunization-cancel').click();page.locator('#immunizations-refresh').click();page.wait_for_function("!document.querySelector('#immunizations-add').disabled")
    page.locator('.immunization-entry').first.get_by_role('button',name='Edit…',exact=True).click();form.get_by_label('Date administered',exact=True).fill('2025');add_blank_row(sid);form.get_by_role('button',name='Save immunization',exact=True).click();page.wait_for_function("!document.querySelector('#immunization-form-dialog').open && !document.querySelector('#immunizations-add').disabled")
    assert entry_rows(sid)[0][2]=='2025' and entry_rows(sid)[0][17]=='2'
    page.locator('#immunizations-master').click();page.locator('.immunization-table').wait_for();page.wait_for_function("!document.querySelector('#immunizations-refresh').disabled")
    assert page.locator('#immunizations-person-label').is_hidden()
    assert 'Synthetic Departed' not in page.locator('#immunizations-content').inner_text()
    rows=page.locator('.immunization-table tbody tr');assert rows.count()==2
    assert rows.filter(has_text='Synthetic vaccine').count()==1 and '2025' in rows.filter(has_text='Synthetic vaccine').inner_text()
    page.locator('#immunizations-deceased').check();assert rows.count()==3 and '(Deceased)' in page.locator('#immunizations-content').inner_text()
    page.locator('#immunizations-search').fill('vaccine');assert rows.count()==1
    page.locator('#immunizations-search').fill('');page.locator('#immunizations-deceased').uncheck()
    page.locator('#immunizations-dialog').screenshot(path='/tmp/bhr-immunizations-master.png')
    # Master list printing reflects default living-only summary, and one header row.
    print_routes=[];page.route('**/icons/icon-512.png',lambda route:print_routes.append(route));page.locator('#immunizations-print').click()
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.body?.textContent.includes('Synthetic vaccine')")
    page.evaluate("()=>{window.printCalls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>{window.printCalls++};}")
    page.wait_for_timeout(100);print_routes.pop().fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes());page.wait_for_function('window.printCalls===1')
    assert page.frame_locator('#bhr-print-frame').locator('thead tr').count()==1
    assert '03/2028' in page.frame_locator('#bhr-print-frame').locator('body').inner_text()
    assert 'Synthetic Departed' not in page.frame_locator('#bhr-print-frame').locator('body').inner_text()
    page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");page.unroute('**/icons/icon-512.png');page.wait_for_function("!document.querySelector('#immunizations-print').disabled")
    page.locator('.immunization-table button').filter(has_text='Synthetic James').click();page.wait_for_function("!document.querySelector('#immunizations-add').disabled")
    assert page.locator('.immunization-entry').count()==2
    page.locator('.immunization-entry').first.get_by_role('button',name='Delete entry…',exact=True).click();page.locator('#immunization-delete-dialog [data-close]').click();assert len(entry_rows(sid))==2
    page.locator('.immunization-entry').first.get_by_role('button',name='Delete entry…',exact=True).click();fail_updates[0]=True;page.locator('#immunization-delete-confirm').click();page.wait_for_function("document.querySelector('#immunization-delete-error').textContent.includes('failed')");assert len(entry_rows(sid))==2
    fail_updates[0]=False;page.locator('#immunization-delete-confirm').click();page.wait_for_function("!document.querySelector('#immunization-delete-dialog').open && !document.querySelector('#immunizations-add').disabled");assert len(entry_rows(sid))==1
    # Source errors never show an empty or apparently complete master list.
    disabled_api[0]=True;page.locator('#immunizations-master').click();page.get_by_role('button',name='Retry',exact=True).wait_for();assert page.locator('.immunization-table').count()==0
    disabled_api[0]=False;page.get_by_role('button',name='Retry',exact=True).click();page.locator('.immunization-table').wait_for()
    page.locator('#immunizations-person').select_option('person-b') if page.locator('#immunizations-person').is_visible() else None
    page.locator('#immunizations-individual').click();page.wait_for_function("!document.querySelector('#immunizations-add').disabled")
    page.locator('#immunizations-person').select_option('person-a');page.wait_for_function("!document.querySelector('#immunizations-add').disabled")
    page.locator('#immunizations-add').click();assert form.get_by_label('Vaccine / immunization name').input_value()==''
    form.get_by_label('Vaccine / immunization name').fill('Synthetic other vaccine');form.get_by_role('button',name='Save immunization',exact=True).click();page.wait_for_function("!document.querySelector('#immunization-form-dialog').open && !document.querySelector('#immunizations-add').disabled")
    assert len(book['sheets'])==3 and len({tab['properties']['title'] for tab in book['sheets']})==3
    page.set_viewport_size({'width':390,'height':844});page.locator('#immunizations-add').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    form.get_by_label('Comments',exact=True).fill('Synthetic private draft');page.locator('#immunization-form-dialog .window-control').click();page.locator('#immunizations-dialog [data-close]').click()
    page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.locator('#immunizations-content').inner_text()=='' and form.get_by_label('Comments',exact=True).input_value()==''
    assert not page.locator('#immunizations-deceased').is_checked() and page.locator('#immunizations-search').input_value()==''
    assert page.evaluate("localStorage.getItem('infirmary.directory.v1')") is None
    assert not errors,errors
    browser.close()
print('PASS: private on-demand immunizations workbook/tabs; dose history and partial dates; optional details; lost response recovery; conflicts and row shifts; master latest doses/filter/deceased/print; edit/delete/retry; patient isolation; mobile; logout cleanup')
