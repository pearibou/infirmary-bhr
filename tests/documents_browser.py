"""Synthetic Drive backend; no real users, notes, folders or network writes."""
import json,re,urllib.parse
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,ignore_event_log_projection,open_drive
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'version':1,'people':[{'id':'person','name':'Synthetic Brother','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
    files={};contents={};counter=[0];directory=[seed];account={'sub':'synthetic-staff','name':'Synthetic Staff'};fail=[False]
    def bump(file):
        counter[0]+=1;file['modifiedTime']=f'2026-01-01T00:00:{counter[0]:02d}.000Z'
    def drive(route):
        req=route.request;url=urllib.parse.urlparse(req.url);query=urllib.parse.parse_qs(url.query);method=req.method
        if '/userinfo' in url.path:route.fulfill(json=account);return
        if fail[0] and method in ('POST','PATCH') and '/upload/' in url.path:
            fail[0]=False;route.fulfill(status=503,json={'error':{'message':'Synthetic write failed'}});return
        if url.path.endswith('/files') and method=='GET':
            q=query.get('q',[''])[0]
            if 'people_directory.json' in q:route.fulfill(json={'files':[{'id':'directory'}]});return
            if 'BHR_event_log.txt' in q:route.fulfill(json={'files':[]});return
            person=re.search("key='personId' and value='([^']+)'",q);parent=re.search("'([^']+)' in parents",q)
            found=[file for file in files.values() if not file.get('trashed') and (file.get('appProperties',{}).get('personId')==person[1] if person else parent and parent[1] in file.get('parents',[]))]
            route.fulfill(json={'files':found});return
        id=url.path.rsplit('/',1)[-1]
        if id=='root':route.fulfill(json={'id':'root','mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}});return
        if id=='directory':
            if method=='PATCH':directory[0]=req.post_data_json
            route.fulfill(json=directory[0] if method=='GET' else {'id':'directory'});return
        if 'uploadType' in query and query['uploadType']==['multipart']:
            boundary=req.headers['content-type'].split('boundary=')[1];parts=req.post_data.split('--'+boundary)
            meta=json.loads(parts[1].split('\r\n\r\n',1)[1].strip());content=json.loads(parts[2].split('\r\n\r\n',1)[1].strip())
            if method=='POST':counter[0]+=1;id='file-'+str(counter[0]);files[id]={'id':id,**meta}
            else:files[id].update(meta)
            bump(files[id]);contents[id]=content;route.fulfill(json=files[id]);return
        if method=='POST' and url.path.endswith('/files'):
            counter[0]+=1;id='folder-'+str(counter[0]);files[id]={'id':id,**req.post_data_json};bump(files[id]);route.fulfill(json=files[id]);return
        if id in files:
            if method=='PATCH':
                files[id].update(req.post_data_json)
                if 'addParents' in query:files[id]['parents']=query['addParents']
                bump(files[id])
            route.fulfill(json=contents[id] if query.get('alt')==['media'] else files[id],headers={'etag':'"'+files[id]['modifiedTime']+'"'});return
        route.fulfill(status=404,json={'error':{'message':'Synthetic file not found'}})
    page.route('https://www.googleapis.com/**',drive);ignore_event_log_projection(page)
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    page.route('https://www.googleapis.com/oauth2/v3/userinfo',lambda route:route.fulfill(json=account))
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-rich-note').click()
    page.locator('#rich-note-name').fill('Synthetic clinical note');page.locator('#rich-note-time').fill('2026-01-02T08:30')
    body=page.locator('#rich-note-body');body.fill('Synthetic clinical text');body.press('Control+a')
    for name in ['Bold','Italic','Underline','Bulleted list']:page.get_by_role('button',name=name,exact=True).click()
    assert '<ul>' in body.inner_html();page.get_by_role('button',name='Numbered list',exact=True).click();assert '<ol>' in body.inner_html()
    fail[0]=True;page.locator('#rich-note-save').click()
    page.wait_for_function("document.querySelector('#rich-note-error').textContent.includes('failed')")
    assert 'Synthetic clinical text' in body.inner_text()
    page.locator('#rich-note-save').click();page.wait_for_function("!document.querySelector('#rich-note-dialog').open")
    note=next(file for file in files.values() if file['appProperties']['kind']=='note');noteid=note['id']
    assert note['parents']==['root'] and contents[noteid]['authorId']=='synthetic-staff'
    assert '<ol>' in contents[noteid]['html'] and '<script' not in contents[noteid]['html']
    assert 'Synthetic clinical text' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    assert 'Synthetic clinical note' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-drive-folder').click()
    rename=page.get_by_label('Folder name',exact=True);rename.wait_for();assert rename.input_value()=='New Folder'
    rename.fill('Synthetic Folder');rename.press('Enter')
    folder_icon=page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic Folder');folder_icon.wait_for()
    folderid=next(file['id'] for file in files.values() if file['name']=='Synthetic Folder')
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic clinical note').drag_to(folder_icon)
    page.wait_for_function('(id)=>!document.querySelector(`#desktop-icons [data-file-id="${id}"]`)',arg=noteid)
    assert files[noteid]['parents']==[folderid]
    folder_icon.dblclick();page.wait_for_function("document.querySelector('#file-browser').open")
    page.locator('#folder-files .drive-file').filter(has_text='Synthetic clinical note').wait_for()
    page.locator('#folder-new-folder').click();rename=page.get_by_label('Folder name',exact=True);rename.wait_for();rename.fill('Nested');rename.press('Enter')
    nested=page.locator('#folder-files .drive-file').filter(has_text='Nested');nested.wait_for()
    page.locator('#folder-files .drive-file').filter(has_text='Synthetic clinical note').drag_to(nested)
    nested.dblclick();page.locator('#folder-files .drive-file').filter(has_text='Synthetic clinical note').wait_for()
    page.locator('#folder-files .drive-file').filter(has_text='Synthetic clinical note').click(button='right')
    page.wait_for_timeout(100)
    assert page.locator('#file-context-menu').is_visible(),page.evaluate("({menu:document.querySelector('#file-context-menu').outerHTML,folder:document.querySelector('#file-path').textContent,status:document.querySelector('#file-status').textContent})")
    page.get_by_role('menuitem',name='Attach note to patient’s chart…').click();page.locator('#file-patient').select_option('person');page.locator('#file-action-confirm').click()
    page.wait_for_function("!document.querySelector('#file-action-dialog').open")
    assert files[noteid]['appProperties']['personId']=='person'
    page.locator('#file-browser [data-close]').click()
    page.locator('.chart-documents button').filter(has_text='Synthetic clinical note').click()
    assert body.inner_text().strip()=='Synthetic clinical text'
    # Drive content is treated as untrusted on read; scripts and attributes disappear.
    page.locator('#rich-note-dialog [data-close]').click();contents[noteid]['html']='<p onclick="alert(1)"><b>Safe</b><script>window.bad=true</script><img src=x onerror="window.bad=true"></p>'
    page.locator('.chart-documents button').filter(has_text='Synthetic clinical note').click()
    page.wait_for_function("document.querySelector('#rich-note-dialog').open")
    assert body.inner_html()=='<p><b>Safe</b></p>' and page.evaluate('window.bad') is None
    page.locator('#rich-note-dialog [data-close]').click()
    # A second connected identity can read but cannot edit, rename, move or trash this note.
    open_drive(page);page.locator('#disconnect').click();account.update(sub='other-staff',name='Other Synthetic Staff')
    page.locator('#google-connect').click();page.wait_for_function("!document.body.classList.contains('drive-locked')")
    page.locator('#drive-dialog [data-close]').click();page.locator('.chart-documents button').filter(has_text='Synthetic clinical note').click()
    page.wait_for_function("document.querySelector('#rich-note-dialog').open")
    assert body.get_attribute('contenteditable')=='false' and page.locator('#rich-note-save').is_hidden()
    assert page.locator('#rich-note-name').is_disabled()
    page.locator('#rich-note-dialog [data-close]').click()
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic Folder').click(button='right');page.get_by_role('menuitem',name='Send to Trash (delete)…').click();page.locator('#file-action-confirm').click()
    page.wait_for_function("document.querySelector('#file-action-error').textContent.includes('Only empty folders')")
    assert not files[folderid].get('trashed') and not files[noteid].get('trashed')
    page.locator('#file-action-dialog [data-close]').click()
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic Folder').dblclick()
    page.locator('#folder-files .drive-file').filter(has_text='Nested').dblclick()
    readonly=page.locator('#folder-files .drive-file').filter(has_text='Synthetic clinical note');readonly.wait_for();readonly.click(button='right')
    for action in ['rename','attach','trash']:assert page.locator(f'#file-context-menu [data-file-action="{action}"]').is_disabled()
    assert readonly.get_attribute('draggable')=='false'
    page.keyboard.press('Escape')
    open_drive(page);page.locator('#disconnect').click()
    assert body.text_content()==''
    account.update(sub='synthetic-staff',name='Synthetic Staff')
    page.locator('#google-connect').click();page.wait_for_function("!document.body.classList.contains('drive-locked')");page.locator('#drive-dialog [data-close]').click()
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic Folder').dblclick()
    page.locator('#folder-files .drive-file').filter(has_text='Nested').dblclick()
    own=page.locator('#folder-files .drive-file').filter(has_text='Synthetic clinical note');own.wait_for();own.click(button='right')
    page.get_by_role('menuitem',name='Send to Trash (delete)…').click();page.locator('#file-action-confirm').click()
    page.wait_for_function("!document.querySelector('#file-action-dialog').open")
    assert files[noteid]['trashed'] is True
    page.wait_for_function("!document.querySelector('.chart-documents').textContent.includes('Synthetic clinical note')")
    page.locator('#file-up').click()
    page.locator('#folder-files .drive-file').filter(has_text='Nested').click(button='right')
    page.get_by_role('menuitem',name='Send to Trash (delete)…').click();page.locator('#file-action-confirm').click()
    page.wait_for_function("!document.querySelector('#file-action-dialog').open")
    assert any(file.get('trashed') for file in files.values() if file['name']=='Nested')
    page.locator('#file-browser [data-close]').click()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    browser.close()
print('PASS: formatted note save/failure/retry; Drive-root storage; inline folder naming; drag/nesting; chart attachment; HTML sanitization; second-user read-only; nonempty-folder delete guard; creator trash; empty-folder trash; mobile')
