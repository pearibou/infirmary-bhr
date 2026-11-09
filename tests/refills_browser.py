"""Synthetic Drive + Sheets backend. No real clinical data or Google writes."""
import copy,json,urllib.parse
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
HEADERS=['Entry ID','Medication','Dose','Route','Frequency','Instructions','Indication','Prescriber','Start date','Status','Scheduled end','Discontinued date','Discontinuation reason','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Completion processed at','Revision']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'version':1,'people':[{'id':'person-a','name':'Synthetic John','firstName':'John','lastName':'Smith','preferredName':'Synthetic John','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]},{'id':'person-b','name':'Synthetic James','firstName':'James','lastName':'Smith','preferredName':'Synthetic James','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
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
            key=body['dataFilters'][0]['developerMetadataLookup']['metadataKey'];assert key in ['bhr.medicationId','bhr.refillId']
            route.fulfill(json={'matchedDeveloperMetadata':[{'developerMetadata':m} for tab in book['sheets'] for m in tab['developerMetadata'] if m['metadataKey']==key]});return
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
        if url.path.endswith('/files') and req.method=='GET':
            q=params.get('q',[''])[0]
            route.fulfill(json={'files':[{'id':'workbook','name':'Medication Lists (BHR)','mimeType':'application/vnd.google-apps.spreadsheet','parents':['root']}] if 'Medication Lists (BHR)' in q else [{'id':'directory'}] if 'people_directory.json' in q else []});return
        if url.path.endswith('/directory'):
            if req.method=='PATCH':directory[0]=req.post_data_json
            route.fulfill(json=directory[0] if req.method=='GET' else {'id':'directory'});return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic Drive route'}})
    page.route('https://www.googleapis.com/**',drive);ignore_event_log_projection(page);page.route('https://sheets.googleapis.com/**',sheets_api)
    page.clock.set_fixed_time(datetime(2026,11,9,17,tzinfo=timezone.utc))
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    page.wait_for_function("!document.querySelector('#logout-power').disabled")
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
    original_medication=copy.deepcopy(entry_rows(sid)[0]);med_id=original_medication[0];count_before=len(book['sheets'])
    card.get_by_role('button',name='Refills…',exact=True).click();page.get_by_text('No refill information recorded.',exact=True).wait_for()
    assert len(book['sheets'])==count_before
    page.get_by_role('button',name='+ Record refill',exact=True).click();refill_form=page.locator('#refill-form')
    refill_form.get_by_label('Last filled (dispensing date)',exact=True).fill('2026-11-01');refill_form.get_by_label('Days supply',exact=True).fill('30');refill_form.get_by_label('Rx number',exact=True).fill('000-SYNTHETIC-RX');refill_form.get_by_label('Refills remaining',exact=True).fill('0');refill_form.get_by_label('Prescription expiration date',exact=True).fill('2026-11-05');refill_form.get_by_label('Dispensing pharmacy',exact=True).fill('SYNTHETIC PRIVATE PHARMACY');refill_form.get_by_label('Adjustment (days)',exact=True).fill('-2');refill_form.get_by_label('Adjustment reason',exact=True).fill('SYNTHETIC PRIVATE ADJUSTMENT')
    lost_add[0]=True;page.locator('#refill-save').click();page.wait_for_function("document.querySelector('#refill-form-error').textContent.includes('lost')")
    assert refill_form.get_by_label('Rx number',exact=True).input_value()=='000-SYNTHETIC-RX'
    refill_sid=next(s['properties']['sheetId'] for s in book['sheets'] if any(m['metadataKey']=='bhr.refills.personId' for m in s['developerMetadata']))
    assert len(entry_rows(refill_sid))==1
    page.locator('#refill-save').click();page.wait_for_function("!document.querySelector('#refill-form-dialog').open && !document.querySelector('#refill-refresh').disabled")
    assert len(entry_rows(refill_sid))==1 and entry_rows(sid)==[original_medication]
    first=copy.deepcopy(entry_rows(refill_sid)[0]);assert first[1]==med_id and first[5]=='000-SYNTHETIC-RX' and first[6]=='0'
    assert '20 days' in page.locator('#refill-content').inner_text() and 'Prescription expired' in page.locator('#refill-content').inner_text() and 'No refills remaining' in page.locator('#refill-content').inner_text()
    assert 'SYNTHETIC PRIVATE PHARMACY' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    # Alerts use existing refill rows and must not mutate the medication/refill sheets.
    page.locator('#refills-dialog [data-close]').click();page.locator('#medications-dialog [data-close]').click()
    snapshot_alerts=copy.deepcopy(grids)
    page.locator('#refill-alert-toggle').click();page.wait_for_function("document.querySelector('#refill-alert-toggle').getAttribute('aria-busy')==='false'")
    assert page.locator('.refill-alert-card').count()==1 and page.locator('#refill-alert-count').inner_text()=='1'
    assert 'No refills remaining' in page.locator('#refill-alert-content').inner_text() and 'SYNTHETIC PRIVATE PHARMACY' in page.locator('#refill-alert-content').inner_text()
    page.locator('#refill-alert-content').get_by_role('button',name='Acknowledge',exact=True).click()
    page.wait_for_function("!document.querySelector('#refill-alert-toggle').classList.contains('needs-attention') && !document.querySelector('#refill-alert-refresh').disabled")
    assert page.locator('#refill-alert-count').inner_text()=='1' and grids==snapshot_alerts
    page.locator('#refill-alert-content').get_by_role('button',name='Refill requested…',exact=True).click();page.locator('#refill-alert-comment').fill('Synthetic pending request');page.locator('#refill-alert-action-form').get_by_role('button',name='Save',exact=True).click()
    page.wait_for_function("!document.querySelector('#refill-alert-action-dialog').open && !document.querySelector('#refill-alert-refresh').disabled")
    assert page.locator('#refill-alert-content').get_by_role('button',name='Request pending',exact=True).is_disabled() and grids==snapshot_alerts
    page.locator('#refill-alert-content').get_by_role('button',name='Remind team on…',exact=True).click();page.locator('#refill-alert-date').fill('2026-11-10');page.locator('#refill-alert-action-form').get_by_role('button',name='Save',exact=True).click()
    page.wait_for_function("!document.querySelector('#refill-alert-action-dialog').open && !document.querySelector('#refill-alert-refresh').disabled")
    assert 'Team reminder 2026-11-10' in page.locator('#refill-alert-content').inner_text()
    page.locator('#alert-preferences-open').click();page.locator('#alert-low-days').fill('25');page.locator('#alert-preferences-form').get_by_role('button',name='Save shared settings',exact=True).click()
    page.wait_for_function("!document.querySelector('#alert-preferences-dialog').open && !document.querySelector('#refill-alert-refresh').disabled")
    assert {event['kind'] for event in directory[0]['refillAlertEvents']}=={'ack','request','remind','settings'}
    assert page.locator('#refill-alert-toggle').evaluate("n=>n.classList.contains('needs-attention')") and 'Low estimated supply' in page.locator('#refill-alert-content').inner_text() and grids==snapshot_alerts
    page.emulate_media(reduced_motion='reduce');assert page.locator('#refill-alert-toggle svg').evaluate('n=>getComputedStyle(n).animationName')=='none';page.emulate_media(reduced_motion='no-preference')
    disabled_api[0]=True;page.locator('#refill-alert-refresh').click();page.wait_for_function("document.querySelector('#refill-alert-status').textContent.includes('incomplete')");assert page.locator('#refill-alert-count').inner_text()=='?'
    disabled_api[0]=False;page.locator('#refill-alert-refresh').click();page.wait_for_function("document.querySelector('#refill-alert-toggle').getAttribute('aria-busy')==='false'");assert page.locator('.refill-alert-card').count()==1
    page.locator('#refill-alert-dialog').screenshot(path='/tmp/bhr-refill-alerts.png');page.locator('#refill-alert-dialog [data-close]').click()
    page.locator('.chart-navigation').get_by_role('button',name='Medications',exact=True).click();page.wait_for_function("!document.querySelector('#med-add').disabled")
    page.locator('.med-entry').filter(has_text='Synthetic tablet 10 mg').get_by_role('button',name='Refills…',exact=True).click();page.wait_for_function("!document.querySelector('#refill-refresh').disabled")
    page.get_by_role('button',name='+ Record refill',exact=True).click();assert refill_form.get_by_label('Dispensing pharmacy',exact=True).input_value()=='SYNTHETIC PRIVATE PHARMACY'
    refill_form.get_by_label('Days supply',exact=True).fill('10');page.locator('#refill-save').click();page.wait_for_function("!document.querySelector('#refill-form-dialog').open && !document.querySelector('#refill-refresh').disabled")
    assert len(entry_rows(refill_sid))==2 and entry_rows(refill_sid)[0][6]==''
    assert 'Refill history (2)' in page.locator('#refill-content').inner_text()
    page.locator('#refill-content summary').click();history=page.locator('.refill-history-entry').first
    history.get_by_role('button',name='Edit refill…',exact=True).click();refill_form.get_by_label('Refills remaining',exact=True).fill('2')
    fail_updates[0]=True;page.locator('#refill-save').click();page.wait_for_function("document.querySelector('#refill-form-error').textContent.includes('failed')");assert page.locator('#refill-form-dialog').is_visible()
    fail_updates[0]=False;page.locator('#refill-save').click();page.wait_for_function("!document.querySelector('#refill-form-dialog').open && !document.querySelector('#refill-refresh').disabled")
    assert entry_rows(refill_sid)[0][6]=='2' and entry_rows(sid)==[original_medication]
    page.locator('#refill-content summary').click();page.locator('.refill-history-entry').first.get_by_role('button',name='Edit refill…',exact=True).click()
    entry_rows(refill_sid)[0][4]='99';refill_form.get_by_label('Refills remaining',exact=True).fill('3');page.locator('#refill-save').click();page.wait_for_function("document.querySelector('#refill-form-error').textContent.includes('changed in the spreadsheet')")
    assert entry_rows(refill_sid)[0][6]=='2';page.locator('#refill-cancel').click()
    sheet(refill_sid)['properties']['title']='Synthetic renamed refill history';page.locator('#refill-refresh').click();page.wait_for_function("!document.querySelector('#refill-refresh').disabled")
    page.locator('#refill-content summary').click();page.locator('.refill-history-entry').first.get_by_role('button',name='Delete refill…',exact=True).click();page.locator('#refill-delete-dialog [data-close]').click();assert len(entry_rows(refill_sid))==2
    page.locator('.refill-history-entry').first.get_by_role('button',name='Delete refill…',exact=True).click();page.locator('#refill-delete-confirm').click();page.wait_for_function("!document.querySelector('#refill-delete-dialog').open && !document.querySelector('#refill-refresh').disabled")
    assert len(entry_rows(refill_sid))==1 and entry_rows(sid)==[original_medication]
    # Removing a medication retains history and prevents new dispensing writes.
    page.get_by_role('button',name='+ Record refill',exact=True).click();refill_form.get_by_label('Days supply',exact=True).fill('30')
    med_row=next(i for i,row in enumerate(grids[sid]) if row and row[0]==med_id);saved_row=copy.deepcopy(grids[sid][med_row]);grids[sid][med_row]=[]
    page.locator('#refill-save').click();page.wait_for_function("document.querySelector('#refill-form-error').textContent.includes('medication was removed')");assert len(entry_rows(refill_sid))==1
    page.locator('#refill-cancel').click();page.locator('#refill-refresh').click();page.wait_for_function("document.querySelector('#refill-content').textContent.includes('Medication removed') && !document.querySelector('#refill-refresh').disabled")
    assert page.locator('#refill-content').get_by_role('button',name='+ Record refill',exact=True).count()==0 and 'SYNTHETIC PRIVATE PHARMACY' in page.locator('#refill-content').inner_text()
    grids[sid][med_row]=saved_row;page.locator('#refill-refresh').click();page.wait_for_function("!document.querySelector('#refill-refresh').disabled")
    page.locator('#refills-dialog').screenshot(path='/tmp/bhr-refill-overview.png')
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.get_by_role('button',name='+ Record refill',exact=True).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.locator('#refill-cancel').click();page.set_viewport_size({'width':1440,'height':1000})
    # A failed history read is an error, never an empty history.
    disabled_api[0]=True;page.locator('#refill-refresh').click();page.wait_for_function("document.querySelector('#refill-content').textContent.includes('unavailable')");assert 'No refill information recorded.' not in page.locator('#refill-content').inner_text();disabled_api[0]=False;page.locator('#refill-content').get_by_role('button',name='Retry',exact=True).click();page.wait_for_function("!document.querySelector('#refill-refresh').disabled")
    page.locator('#refills-dialog [data-close]').click()
    # Print only clinical fields, even with refill history present.
    pending_print=[];page.route('**/icons/icon-512.png',lambda route:pending_print.append(route));page.locator('#med-print').click();page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.querySelector('table')")
    page.evaluate("window.printCalls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>window.printCalls++");page.wait_for_timeout(100);pending_print.pop().fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes());page.wait_for_function('window.printCalls===1')
    printed=page.frame_locator('#bhr-print-frame').locator('body').inner_text()
    for secret in ['000-SYNTHETIC-RX','SYNTHETIC PRIVATE PHARMACY','SYNTHETIC PRIVATE ADJUSTMENT','Refills left','Days supply']:assert secret not in printed
    assert 'Synthetic tablet 10 mg' in printed;page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))")
    page.locator('#medications-dialog [data-close]').click();page.locator('.person strong').filter(has_text='Synthetic James').click();page.locator('.chart-navigation').get_by_role('button',name='Medications',exact=True).click();page.get_by_role('button',name='+ Add medication list',exact=True).click();page.wait_for_function("!document.querySelector('#med-add').disabled && !document.querySelector('#med-controls').hidden")
    page.locator('#med-refills').click();page.get_by_text('No medications available for refill tracking.',exact=True).wait_for();assert 'SYNTHETIC PRIVATE PHARMACY' not in page.locator('#refill-content').inner_text()
    page.locator('#refills-dialog [data-close]').click();page.locator('#medications-dialog [data-close]').click();page.locator('.person strong').filter(has_text='Synthetic John').click();page.locator('.chart-navigation').get_by_role('button',name='Medications',exact=True).click();page.wait_for_function("!document.querySelector('#med-refills').disabled && !document.querySelector('#med-controls').hidden")
    page.locator('#med-refills').click();page.wait_for_function("!document.querySelector('#refill-refresh').disabled");page.get_by_role('button',name='+ Record refill',exact=True).click();refill_form.get_by_label('Rx number',exact=True).fill('SYNTHETIC UNSAVED PRIVATE RX');page.locator('#refill-form-dialog .window-control').click();page.locator('#refills-dialog [data-close]').click();page.locator('#medications-dialog [data-close]').click()
    page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.locator('#refill-content').text_content()=='' and refill_form.get_by_label('Rx number',exact=True).input_value()==''
    assert 'SYNTHETIC PRIVATE PHARMACY' not in page.locator('body').text_content() and 'SYNTHETIC UNSAVED PRIVATE RX' not in page.locator('body').text_content()
    assert entry_rows(sid)==[original_medication] and len(entry_rows(refill_sid))==1
    assert not errors,errors
    browser.close()
print('PASS: existing medication unchanged; on-demand separate refill sheet; stable IDs; loss/retry idempotence; calculations; unknown vs zero; pharmacy defaults; edit/failure/conflict; deletion; renamed tab; mobile; read errors; print exclusion; logout')
