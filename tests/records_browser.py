from browser_helpers import prepare_test_page,unlock_test_drive,open_drive,fill_death_date
"""Only synthetic records and generated image bytes; no real health information."""
from playwright.sync_api import sync_playwright
import json, struct, zlib
from pathlib import Path
# A valid 2x2 opaque image, generated only in memory.
def chunk(kind,body):
    return struct.pack('!I',len(body))+kind+body+struct.pack('!I',zlib.crc32(kind+body)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',2,2,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\x88\x88\x88\xff'*2)*2))+chunk(b'IEND',b'')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':900},service_workers='block')
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    legacy={'id':'legacy','name':'Legacy Test','info':'Original information','updatedAt':'2026-01-01T00:00:00Z','birthDate':{'year':'1940','month':'1','day':'1'},'notes':[{'id':'old-note','text':'Legacy observation','createdAt':'2026-01-01T00:00:00Z'}],'driveFolders':[{'id':'person-docs','name':'Person documents'}]}
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps({'version':1,'people':[legacy]}))+");window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:'synthetic',expires_in:3600})})}}};")
    page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body="window.INFIRMARY_CONFIG={clientId:'test.apps.googleusercontent.com'}"))
    account={'sub':'staff-a','name':'Staff Alpha'};uploads=[];photo_parents=[]
    def drive(route):
        req=route.request;url=req.url
        if '/oauth2/v3/userinfo' in url:route.fulfill(json=account)
        elif req.method=='PUT':uploads.append(req.post_data_buffer);route.fulfill(json={'id':'photo-file-'+str(len(uploads))})
        elif 'uploadType=resumable' in url:
            photo_parents.append(json.loads(req.post_data)['parents'])
            route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Location','Location':'https://www.googleapis.com/upload/drive/v3/files?upload_id=photo-test'})
        elif 'files/photo-file-' in url:route.fulfill(content_type='image/png',body=png)
        elif 'files?q=' in url:route.fulfill(json={'files':[]})
        elif req.method=='POST':route.fulfill(json={'id':'directory-file'})
        else:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
    page.route('https://www.googleapis.com/**',drive)
    page.add_init_script("localStorage.setItem('infirmary.drive',JSON.stringify({folder:'directory-only',folderName:'Backend directory folder'}))")
    prepare_test_page(page)
    page.goto('http://127.0.0.1:8000')
    unlock_test_drive(page,profile=False)
    assert page.locator('.person-header .avatar').inner_text()=='LT'
    page.get_by_role('button',name='Edit record for Legacy Test',exact=True).click()
    dialog=page.locator('#person-dialog')
    assert dialog.get_by_label('Preferred name',exact=True).input_value()=='Legacy Test'
    assert dialog.get_by_label('Death month',exact=True).is_disabled()
    dialog.get_by_label('This person is deceased').check()
    assert dialog.get_by_label('Death month',exact=True).is_enabled()
    fill_death_date(dialog,'1930-01-01')
    page.locator('#person-submit').click()
    assert 'precede' in page.locator('#person-error').inner_text()
    fill_death_date(dialog,'2020-01-01')
    dialog.get_by_label('Preferred name',exact=True).fill('Brother Alpha')
    page.locator('#person-submit').click()
    assert page.locator('.age').inner_text()=='Age at death: 80 years'
    assert '2020-01-01' in page.locator('.death-status').inner_text()
    assert page.locator('.note').count()==1
    assert page.get_by_role('link',name='Person documents').is_visible()
    assert page.locator('.note-pencil').count()==0
    open_drive(page);page.locator('#google-connect').click()
    page.wait_for_function("document.querySelector('#current-user').textContent.includes('Staff Alpha')")
    page.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    page.get_by_label('New note',exact=True).fill('Author observation');page.get_by_label('New note',exact=True).press('Enter')
    authored=page.locator('.note').filter(has_text='Author observation')
    assert authored.locator('.note-author').inner_text()=='Entered by Staff Alpha'
    authored.locator('.note-pencil').click()
    page.locator('#note-edit-time').fill('2026-01-02T10:30')
    page.locator('#note-edit-text').fill('Corrected observation')
    page.locator('#note-edit-form').get_by_role('button',name='Save note edit',exact=True).click()
    entry=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people[0].notes[1]")
    assert entry['text']=='Author observation' and entry['edits'][0]['text']=='Corrected observation'
    assert entry['authorId']=='staff-a' and '2026-01-02' in entry['edits'][0]['noteAt']
    assert page.locator('.note details').count()==0 and 'Edited' in page.locator('.note').filter(has_text='Corrected observation').inner_text()
    assert page.locator('.person-folders').evaluate('el=>el===el.parentElement.lastElementChild')
    assert page.locator('.record-actions button').all_text_contents()==['✎','Upload file…']
    assert page.locator('.note-pencil').count()==1
    assert page.locator('.note').filter(has_text='Corrected observation').get_attribute('draggable')=='true'
    page.locator('.note-pencil').click()
    assert page.locator('#note-print svg').count()==1 and page.locator('#note-trash svg').count()==1
    print_routes=[];page.route('**/icons/icon-512.png',lambda route:print_routes.append(route));page.locator('#note-print').click()
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.body?.textContent.includes('Corrected observation')")
    page.evaluate("window.printCalls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>window.printCalls++")
    page.wait_for_timeout(100);print_routes.pop().fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes());page.wait_for_function('window.printCalls===1')
    assert 'Clinical quick note' in page.frame_locator('#bhr-print-frame').locator('body').inner_text()
    page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");page.unroute('**/icons/icon-512.png')

    page.locator('#note-trash').click();assert page.locator('#trash-dialog').is_visible();page.locator('#trash-dialog [data-close]').click()
    page.locator('#note-dialog').get_by_role('button',name='Cancel',exact=True).click()
    page.get_by_label('New note',exact=True).fill('Synthetic trash test');page.get_by_label('New note',exact=True).press('Enter')
    assert 'Synthetic trash test' in page.locator('.notes .note').first.inner_text()
    page.locator('.note').filter(has_text='Synthetic trash test').locator('.note-pencil').click();page.locator('#note-trash').click();page.locator('#trash-form button[type=submit]').click()
    assert page.locator('.note').filter(has_text='Synthetic trash test').count()==0 and not page.locator('#note-dialog').is_visible()

    open_drive(page);page.locator('#disconnect').click()
    account.update(sub='staff-b',name='Staff Beta')
    page.locator('#google-connect').click()
    page.wait_for_function("document.querySelector('#current-user').textContent.includes('Staff Beta')")
    page.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    assert page.locator('.note-pencil').count()==0
    assert page.locator('.note').filter(has_text='Corrected observation').get_attribute('draggable')=='false'
    page.evaluate("document.dispatchEvent(new CustomEvent('trash-request',{detail:{personId:'legacy',noteId:JSON.parse(localStorage.getItem('infirmary.directory.v1')).people[0].notes[1].id}}))")
    assert not page.locator('#trash-dialog').is_visible()
    assert 'Only the Google account' in page.locator('#toast').inner_text()
    # Even a stale editor submitted after an account switch must reject editing.
    page.locator('#note-dialog').evaluate('(el)=>el.showModal()')
    page.locator('#note-edit-time').fill('2026-01-02T10:30')
    page.locator('#note-edit-text').fill('Attempt by another account')
    page.locator('#note-edit-form').get_by_role('button',name='Save note edit').click()
    assert 'Only the Google account' in page.locator('#note-edit-error').inner_text()
    page.locator('#note-dialog').get_by_role('button',name='Cancel',exact=True).click()
    page.locator('#add-person').click()
    dialog.get_by_label('Preferred name',exact=True).fill('Photo Test')
    assert page.locator('#person-photo-folder').count()==0
    page.locator('#person-photo').set_input_files({'name':'synthetic.png','mimeType':'image/png','buffer':png})
    page.locator('#person-photo-preview img').wait_for()
    page.locator('#person-submit').click()
    page.locator('#person-dialog').wait_for(state='hidden')
    page.wait_for_function("document.querySelector('.person-header .avatar img')?.complete")
    assert uploads==[png]
    assert page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).eventLog.some(event=>event.action==='photo.uploaded')")
    record=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people[1]")
    assert record['photo']=={'fileId':'photo-file-1','folderId':'root'}
    assert 'data:image' not in json.dumps(record) and 'blob:' not in json.dumps(record)
    page.get_by_role('button',name='Edit this record',exact=True).click()
    dialog.get_by_label('First name',exact=True).fill('Test')
    page.locator('#person-submit').click()
    record_after=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people[1]")
    assert record_after['photo']==record['photo'] and len(uploads)==1
    for folder_id in ('person-folder-one','person-folder-two'):
        page.get_by_role('button',name='Attach folder…',exact=True).click()
        page.get_by_label('Folder name (optional)').fill(folder_id)
        page.get_by_label('Google Drive folder link',exact=True).fill('https://drive.google.com/drive/folders/'+folder_id)
        page.locator('#folder-dialog').get_by_role('button',name='Attach folder',exact=True).click()
    page.get_by_role('button',name='Edit this record',exact=True).click()
    assert page.locator('#person-photo-folder').count()==0
    page.locator('#person-photo').set_input_files({'name':'replacement.png','mimeType':'image/png','buffer':png})
    page.locator('#person-photo-preview img').wait_for()
    page.locator('#person-submit').click()
    page.locator('#person-dialog').wait_for(state='hidden')
    replaced=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people[1]")
    assert replaced['photo']=={'fileId':'photo-file-2','folderId':'person-folder-one'} and len(uploads)==2
    assert photo_parents==[['root'],['person-folder-one']]
    page.reload()
    unlock_test_drive(page,profile=False)
    assert page.locator('.note-pencil').count()==0
    page.locator('.person').filter(has_text='Photo Test').click()
    page.locator('.person-header .avatar img').wait_for(state='visible')
    page.set_viewport_size({'width':390,'height':844})
    page.get_by_role('button',name='Edit this record',exact=True).click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    b.close()
    print('PASS: record pencil; legacy preservation; deceased/date validation; age at death; Google author identity; owner-only revision history; stale-editor denial; new-person Drive photo; metadata-only persistence; initials fallback; mobile editor')
