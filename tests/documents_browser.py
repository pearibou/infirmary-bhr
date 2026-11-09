"""Synthetic Drive backend; no real users, notes, folders or network writes."""
import json,re,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,ignore_event_log_projection,open_drive
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'version':1,'people':[{'id':'person','name':'Synthetic Brother','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
    seed['people'].append({'id':'departed','name':'Synthetic Departed','preferredName':'Synthetic Departed','lastName':'Zimmer','deceased':True,'deathDate':{'year':'2020'},'info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]})
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
        if id=='root':route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}});return
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
    prompts=[]
    page.on('dialog',lambda dialog:(prompts.append(dialog.message),dialog.dismiss()))
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-rich-note').click()
    page.locator('#rich-note-name').fill('Synthetic blank note');page.locator('#rich-note-save').click()
    page.wait_for_function("document.querySelector('#rich-note-dialog').classList.contains('note-viewing') && !document.querySelector('#rich-note-edit').disabled");assert page.locator('#rich-note-body').get_attribute('contenteditable')=='false';page.locator('#rich-note-dialog [data-close]').click()
    blank=page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic blank note');blank.wait_for()
    blankid=next(file['id'] for file in files.values() if file['name']=='Synthetic blank note');pending_read=[]
    pattern=f'https://www.googleapis.com/drive/v3/files/{blankid}?fields=*'
    page.route(pattern,lambda route:pending_read.append(route));blank.dblclick()
    page.wait_for_function("document.querySelector('#rich-note-dialog').getAttribute('aria-busy')==='true'")
    page.keyboard.press('Delete');assert not page.locator('#file-action-dialog').is_visible()
    page.wait_for_timeout(50);assert len(pending_read)==1
    pending_read[0].fulfill(json=files[blankid]);page.unroute(pattern)
    page.wait_for_function("document.querySelector('#rich-note-dialog').open&&document.querySelector('#rich-note-dialog').getAttribute('aria-busy')!=='true'")
    assert page.evaluate("document.activeElement.id")=='rich-note-body'
    assert page.locator('#rich-note-body').get_attribute('contenteditable')=='false' and page.locator('#rich-note-save').is_hidden() and page.locator('.rich-toolbar').is_hidden()
    page.keyboard.type('Must not modify saved note');assert page.locator('#rich-note-body').inner_text()==''
    page.locator('#rich-note-edit').click()
    page.keyboard.type('Editable blank note')
    page.keyboard.press('Enter');page.keyboard.type('Second line');page.keyboard.press('Backspace');page.keyboard.press('Delete')
    assert page.locator('#rich-note-body').inner_text().startswith('Editable blank note')
    assert not page.locator('#file-action-dialog').is_visible() and not prompts,prompts
    page.locator('#rich-note-dialog .window-control').click();page.locator('#window-dock [data-window=rich-note-dialog]').click()
    assert page.evaluate("document.activeElement.id")=='rich-note-body'
    page.locator('#rich-note-dialog [data-close]').click()
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-rich-note').click()
    assert not prompts,prompts
    page.locator('#rich-note-dialog [data-close]').click()
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#resume-note-drafts').click()
    page.locator('#note-drafts-list button').filter(has_text='Synthetic blank note').click()
    page.wait_for_function("document.querySelector('#rich-note-dialog').open&&document.querySelector('#rich-note-dialog').getAttribute('aria-busy')!=='true'")
    assert page.locator('#rich-note-body').inner_text().startswith('Editable blank note')
    page.locator('#rich-note-save').click();page.wait_for_function("document.querySelector('#rich-note-dialog').classList.contains('note-viewing') && !document.querySelector('#rich-note-edit').disabled");assert page.locator('#rich-note-body').get_attribute('contenteditable')=='false';page.locator('#rich-note-dialog [data-close]').click()
    blank.click(button='right');page.get_by_role('menuitem',name='Send to Trash (delete)…').click();page.locator('#file-action-confirm').click()
    page.wait_for_function("!document.querySelector('#file-action-dialog').open")
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-rich-note').click()
    page.locator('#rich-note-name').fill('Synthetic clinical note');page.locator('#rich-note-time').fill('2026-01-02T08:30')
    body=page.locator('#rich-note-body');body.fill('Synthetic clinical text');body.press('Control+a')
    for name in ['Bold','Italic','Underline','Bulleted list']:
        button=page.get_by_role('button',name=name,exact=True);button.click()
        assert button.get_attribute('aria-pressed')=='true'
    assert page.get_by_role('button',name='Bulleted list',exact=True).locator('svg circle').count()==3
    assert page.get_by_role('button',name='Numbered list',exact=True).locator('svg text').all_text_contents()==['1','2','3']
    formatted=body.inner_html()
    page.evaluate("""()=>{
        const body=document.querySelector('#rich-note-body');body.innerHTML='<p><b>Bold sample</b></p><p>Plain sample</p>';body.focus();
        const range=document.createRange();range.setStart(body.querySelector('b').firstChild,1);range.collapse(true);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    }""")
    page.wait_for_function("document.querySelector('[data-format=bold]').getAttribute('aria-pressed')==='true'")
    page.evaluate("""()=>{const body=document.querySelector('#rich-note-body'),range=document.createRange();range.setStart(body.lastChild.firstChild,1);range.collapse(true);getSelection().removeAllRanges();getSelection().addRange(range);} """)
    page.wait_for_function("document.querySelector('[data-format=bold]').getAttribute('aria-pressed')==='false'")
    body.press('Control+b');assert page.get_by_role('button',name='Bold',exact=True).get_attribute('aria-pressed')=='true'
    body.press('Control+b');assert page.get_by_role('button',name='Bold',exact=True).get_attribute('aria-pressed')=='false'
    page.evaluate("html=>{const body=document.querySelector('#rich-note-body');body.innerHTML=html;body.focus();const range=document.createRange();range.selectNodeContents(body);getSelection().removeAllRanges();getSelection().addRange(range);}",formatted)
    assert '<ul>' in body.inner_html();page.get_by_role('button',name='Numbered list',exact=True).click();assert '<ol>' in body.inner_html()
    fail[0]=True;page.locator('#rich-note-save').click()
    page.wait_for_function("document.querySelector('#rich-note-error').textContent.includes('failed')")
    assert 'Synthetic clinical text' in body.inner_text()
    page.locator('#rich-note-save').click();page.wait_for_function("document.querySelector('#rich-note-dialog').classList.contains('note-viewing') && !document.querySelector('#rich-note-edit').disabled");assert page.locator('#rich-note-body').get_attribute('contenteditable')=='false';page.locator('#rich-note-dialog [data-close]').click()
    note=next(file for file in files.values() if file['name']=='Synthetic clinical note');noteid=note['id']
    assert note['parents']==['root'] and contents[noteid]['authorId']=='synthetic-staff'
    assert '<ol>' in contents[noteid]['html'] and '<script' not in contents[noteid]['html']
    assert 'Synthetic clinical text' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    assert 'Synthetic clinical note' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    icon=page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic clinical note');icon.wait_for();icon.hover()
    page.locator('#filename-tooltip').wait_for(state='visible')
    assert page.locator('#filename-tooltip').inner_text()=='Synthetic clinical note'
    assert icon.locator('span').evaluate("el=>el.scrollWidth>el.clientWidth&&getComputedStyle(el).whiteSpace==='nowrap'&&getComputedStyle(el).textOverflow==='ellipsis'")
    assert icon.locator('svg').bounding_box()['height']==44
    assert page.locator('#filename-tooltip').evaluate("el=>getComputedStyle(el).backgroundColor")=='rgb(255, 255, 255)'
    page.keyboard.press('Escape');assert page.locator('#filename-tooltip').is_hidden()
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-drive-folder').click()
    rename=page.get_by_label('Folder name',exact=True);rename.wait_for();assert rename.input_value()=='New Folder'
    rename.fill('Synthetic Folder');rename.press('Enter')
    folder_icon=page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic Folder');folder_icon.wait_for()
    folderid=next(file['id'] for file in files.values() if file['name']=='Synthetic Folder')
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic clinical note').drag_to(folder_icon)
    try:page.wait_for_function('(id)=>!document.querySelector(`#desktop-icons [data-file-id="${id}"]`)',arg=noteid,timeout=10000)
    except Exception:
        print({'note':files[noteid],'folder':files[folderid],'status':page.locator('#file-status').text_content(),'prompts':prompts});raise
    assert files[noteid]['parents']==[folderid]
    folder_icon.dblclick()
    topview=page.locator(f'.folder-window[data-folder-id="{folderid}"]');topview.wait_for()
    topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note').wait_for()
    topview.locator('[data-field=folder-new-folder]').click();rename=page.get_by_label('Folder name',exact=True);rename.wait_for();rename.fill('Nested');rename.press('Enter')
    nested=topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Nested');nested.wait_for()
    topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note').drag_to(nested)
    nestedid=next(file['id'] for file in files.values() if file['name']=='Nested')
    nested.dblclick();nestedview=page.locator(f'.folder-window[data-folder-id="{nestedid}"]');nestedview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note').wait_for()
    assert page.locator('.folder-window[open]').count()==2
    topid=topview.get_attribute('id');nestedwinid=nestedview.get_attribute('id')
    initial=nestedview.bounding_box()
    nestedview.locator('.window-control').click();topview.locator('.window-control').click()
    for id,name in [(topid,'Synthetic Folder'),(nestedwinid,'Nested')]:
        item=page.locator(f'#window-dock [data-window="{id}"]');assert item.inner_text()==name and item.locator('svg.dock-folder-icon').count()==1
    page.locator('#minimize-main').click()
    assert page.locator('#window-dock [data-window=records-window] svg.dock-folder-icon').count()==0
    # Refresh a minimized folder's name without losing its identity/geometry.
    files[folderid]['name']='Synthetic Folder renamed';bump(files[folderid])
    page.locator('#window-dock [data-window=records-window]').click();page.locator('#manual-sync').click()
    page.wait_for_function('(id)=>document.querySelector(`#window-dock [data-window="${id}"]`).textContent.includes("renamed")',arg=topid)
    page.locator(f'#window-dock [data-window="{topid}"]').click();page.locator(f'#window-dock [data-window="{nestedwinid}"]').click()
    assert nestedview.bounding_box()==initial and page.locator('.folder-window[open]').count()==2
    # Up restores the parent window; opening its child again reuses the child.
    nestedview.locator('[data-field=file-up]').click()
    def move_window(win,delta):
        box=win.locator('.dialog-title').bounding_box();x=box['x']+box['width']-30;y=box['y']+box['height']/2
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+delta,y,steps=5);page.mouse.up()
    move_window(topview,-500)
    topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Nested').dblclick()
    assert page.locator('.folder-window[open]').count()==2
    move_window(nestedview,700)
    nestedview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note').drag_to(topview.locator('[data-field=folder-files]'),target_position={'x':180,'y':100})
    topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note').wait_for()
    assert files[noteid]['parents']==[folderid]
    topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note').drag_to(topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Nested'))
    nestedview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note').wait_for()
    assert files[noteid]['parents']==[nestedid]

    nestedview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note').click(button='right')
    page.wait_for_timeout(100)
    assert page.locator('#file-context-menu').is_visible(),page.evaluate("({menu:document.querySelector('#file-context-menu').outerHTML,folder:document.querySelector('[data-field=file-path]')?.textContent,status:document.querySelector('#file-status').textContent})")
    page.get_by_role('menuitem',name='Attach note to patient’s chart…').click()
    options=page.locator('#file-patient option').evaluate_all("items=>items.map(item=>({text:item.textContent,value:item.value,disabled:item.disabled}))")
    assert options[1]['value']=='person' and options[2]['disabled'] and '─' in options[2]['text']
    assert options[3]['text']=='Synthetic Departed (Deceased)'
    page.locator('#file-patient').select_option('departed');assert page.locator('#file-patient').input_value()=='departed'
    page.locator('#file-patient').select_option('person');page.locator('#file-action-confirm').click()
    page.wait_for_function("!document.querySelector('#file-action-dialog').open")
    assert files[noteid]['appProperties']['personId']=='person'
    page.locator('.folder-window[open]').evaluate_all("windows=>windows.forEach(el=>el.querySelector('[data-field=close]').click())")
    page.locator('.clinical-documents').get_by_role('button',name='+ New note',exact=True).click()
    page.locator('#rich-note-name').fill('Synthetic chart-created note')
    page.locator('#rich-note-body').fill('Synthetic chart entry text')
    page.locator('#rich-note-save').click();page.wait_for_function("document.querySelector('#rich-note-dialog').classList.contains('note-viewing') && !document.querySelector('#rich-note-edit').disabled");assert page.locator('#rich-note-body').get_attribute('contenteditable')=='false';page.locator('#rich-note-dialog [data-close]').click()
    chart_created=next(file for file in files.values() if file['name']=='Synthetic chart-created note')
    assert chart_created['appProperties']['personId']=='person' and chart_created['appProperties']['authorId']=='synthetic-staff'
    page.locator('.chart-documents button').filter(has_text='Synthetic chart-created note').wait_for()
    files.pop(chart_created['id']);contents.pop(chart_created['id'])
    files['newest-chart-note']=json.loads(json.dumps(files[noteid]));files['newest-chart-note'].update(id='newest-chart-note',name='Synthetic newest chart entry',createdTime='2099-01-01T00:00:00Z');files['newest-chart-note']['appProperties']['createdAt']='2099-01-01T00:00:00Z';contents['newest-chart-note']={**contents[noteid],'createdAt':'2099-01-01T00:00:00Z'}
    page.locator('.clinical-documents .notes-heading').get_by_role('button',name='↻ Refresh',exact=True).click();page.wait_for_function("document.querySelector('.chart-documents button')?.textContent.includes('Synthetic newest chart entry')")
    assert page.locator('.chart-documents button').first.locator('svg').count()==1 and page.locator('.chart-document-time').first.get_attribute('datetime')=='2099-01-01T00:00:00Z'
    files.pop('newest-chart-note');contents.pop('newest-chart-note');page.locator('.clinical-documents .notes-heading').get_by_role('button',name='↻ Refresh',exact=True).click();page.wait_for_function("document.querySelectorAll('.chart-documents button').length===1")
    page.locator('.chart-documents button').filter(has_text='Synthetic clinical note').click()
    page.wait_for_function("document.querySelector('#rich-note-dialog').getAttribute('aria-busy')!=='true'")
    assert body.inner_text().strip()=='Synthetic clinical text'
    assert page.locator('#rich-note-name').is_hidden() and page.locator('#rich-note-time').is_hidden()
    assert page.locator('#rich-note-view-title').inner_text()=='Synthetic clinical note'
    page.locator('#rich-note-dialog').screenshot(path='/tmp/bhr-clinical-note-view.png')
    assert page.locator('#rich-note-print svg').count()==1 and page.locator('#rich-note-trash').is_visible()
    print_routes=[];page.route('**/icons/abbey-letterhead.png',lambda route:print_routes.append(route));page.locator('#rich-note-print').click()
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.body?.textContent.includes('Synthetic clinical text')")
    page.evaluate("window.printCalls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>window.printCalls++")
    page.wait_for_timeout(100);print_routes.pop().fulfill(content_type='image/png',body=Path('icons/abbey-letterhead.png').read_bytes());page.wait_for_function('window.printCalls===1')
    assert page.frame_locator('#bhr-print-frame').locator('ol').count()==1
    page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");page.unroute('**/icons/abbey-letterhead.png')

    # Drive content is treated as untrusted on read; scripts and attributes disappear.
    page.locator('#rich-note-dialog [data-close]').click();contents[noteid]['html']='<p onclick="alert(1)"><b>Safe</b><script>window.bad=true</script><img src=x onerror="window.bad=true"></p>'
    page.locator('.chart-documents button').filter(has_text='Synthetic clinical note').click()
    page.wait_for_function("document.querySelector('#rich-note-dialog').open&&document.querySelector('#rich-note-dialog').getAttribute('aria-busy')!=='true'")
    assert body.inner_html()=='<p><b>Safe</b></p>' and page.evaluate('window.bad') is None
    page.locator('#rich-note-edit').click();body.fill('Synthetic unsaved private draft')
    page.locator('#rich-note-dialog [data-close]').click()
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-rich-note').click()
    page.locator('#rich-note-dialog [data-close]').click()
    assert not prompts,prompts
    # A second connected identity can read but cannot edit, rename, move or trash this note.
    open_drive(page);page.locator('#disconnect').click();account.update(sub='other-staff',name='Other Synthetic Staff')
    page.locator('#google-connect').click();page.wait_for_function("!document.body.classList.contains('drive-locked')")
    page.locator('#drive-dialog [data-close]').click();page.locator('.chart-documents button').filter(has_text='Synthetic clinical note').click()
    page.wait_for_function("document.querySelector('#rich-note-dialog').open&&document.querySelector('#rich-note-dialog').getAttribute('aria-busy')!=='true'")
    assert 'Synthetic unsaved private draft' not in body.inner_text()
    assert page.locator('#rich-note-edit').is_hidden() and page.locator('.rich-toolbar').is_hidden()
    assert body.get_attribute('contenteditable')=='false' and page.locator('#rich-note-save').is_hidden() and page.locator('#rich-note-trash').is_hidden()
    assert page.locator('#rich-note-name').is_disabled()
    baseline=json.dumps(contents[noteid],sort_keys=True);page.locator('#rich-note-edit').evaluate('b=>b.click()');page.locator('#rich-note-form').evaluate("f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");assert body.get_attribute('contenteditable')=='false' and json.dumps(contents[noteid],sort_keys=True)==baseline
    page.locator('#rich-note-dialog [data-close]').click()
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic Folder').click(button='right');page.get_by_role('menuitem',name='Send to Trash (delete)…').click();page.locator('#file-action-confirm').click()
    page.wait_for_function("document.querySelector('#file-action-error').textContent.includes('Only empty folders')")
    assert not files[folderid].get('trashed') and not files[noteid].get('trashed')
    page.locator('#file-action-dialog [data-close]').click()
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic Folder').dblclick()
    topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Nested').dblclick()
    readonly=nestedview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note');readonly.wait_for();readonly.click(button='right')
    for action in ['rename','attach','trash']:assert page.locator(f'#file-context-menu [data-file-action="{action}"]').is_disabled()
    assert readonly.get_attribute('draggable')=='false'
    page.keyboard.press('Escape')
    open_drive(page);page.locator('#disconnect').click()
    assert body.text_content()==''
    assert page.locator('#resume-note-drafts').is_hidden() and page.locator('#note-drafts-list').text_content()==''
    assert page.locator('.folder-window').count()==0
    assert page.locator('#window-dock .dock-folder-icon').count()==0
    account.update(sub='synthetic-staff',name='Synthetic Staff')
    page.locator('#google-connect').click();page.wait_for_function("!document.body.classList.contains('drive-locked')");page.locator('#drive-dialog [data-close]').click()
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic Folder').dblclick()
    topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Nested').dblclick()
    own=nestedview.locator('[data-field=folder-files] .drive-file').filter(has_text='Synthetic clinical note');own.wait_for();own.dblclick()
    page.locator('#rich-note-edit').click();page.wait_for_function("document.querySelector('#rich-note-body').contentEditable==='true'");page.locator('#rich-note-trash').click();page.locator('#file-action-confirm').click()
    page.wait_for_function("!document.querySelector('#file-action-dialog').open")
    assert files[noteid]['trashed'] is True
    page.wait_for_function("!document.querySelector('.chart-documents').textContent.includes('Synthetic clinical note')")
    nestedview.locator('[data-field=file-up]').click()
    topview.locator('[data-field=folder-files] .drive-file').filter(has_text='Nested').click(button='right')
    page.get_by_role('menuitem',name='Send to Trash (delete)…').click();page.locator('#file-action-confirm').click()
    page.wait_for_function("!document.querySelector('#file-action-dialog').open")
    assert any(file.get('trashed') for file in files.values() if file['name']=='Nested')
    page.locator('.folder-window[open]').evaluate_all("windows=>windows.forEach(el=>el.querySelector('[data-field=close]').click())")
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-rich-note').click();body.fill('Synthetic discard draft');page.locator('#rich-note-trash').click();page.locator('#discard-rich-note').click();assert not page.locator('#rich-note-dialog').is_visible()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    browser.close()
print('PASS: blank-note typing and Delete; safe loading; prompt-free draft switching; cross-user draft cleanup; independent folder windows; named/icon dock entries; minimized rename refresh; geometry restoration; formatted note save/failure/retry; workspace storage; inline folder naming; drag/nesting; chart attachment; HTML sanitization; second-user read-only; nonempty-folder delete guard; creator trash; empty-folder trash; mobile')
