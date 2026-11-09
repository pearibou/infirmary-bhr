from browser_helpers import prepare_test_page,unlock_test_drive,open_drive,fill_death_date
"""Synthetic desktop geometry, drag-to-trash confirmation and stale-copy sync tests."""
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=b.new_context(viewport={'width':1280,'height':900},service_workers='block')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    person=lambda id,name:{'id':id,'name':name,'info':'Synthetic record','updatedAt':'2026-01-01T00:00:00Z','notes':[{'id':'note-'+id,'text':'Synthetic note for '+name,'authorId':'synthetic-staff','authorName':'Synthetic Staff','createdAt':'2026-01-01T00:00:00Z'}]}
    data={'version':1,'people':[person('a','Alpha Test'),person('b','Beta Test')]}
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(data))+");window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:'test',expires_in:3600})})}}};")
    page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body="window.INFIRMARY_CONFIG={clientId:'test.apps.googleusercontent.com'}"))
    uploads=[]
    def drive(route):
        url=route.request.url
        if '/oauth2/' in url:route.fulfill(json={'sub':'tester','name':'Synthetic Tester'})
        elif route.request.method=='PATCH':uploads.append(json.loads(route.request.post_data));route.fulfill(json={'id':'directory'})
        elif 'alt=media' in url:route.fulfill(json=data) # deliberately stale copy
        elif 'files?q=' in url:route.fulfill(json={'files':[{'id':'directory'}]})
        else:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
    page.route('https://www.googleapis.com/**',drive)
    prepare_test_page(page)
    page.goto('http://127.0.0.1:8000')
    unlock_test_drive(page,profile=True)
    window=page.locator('.window');footer=page.locator('.statusbar');bar=page.locator('.titlebar');trash=page.locator('#desktop-trash')
    def drag_to_trash(source):
        source.scroll_into_view_if_needed();rect=source.bounding_box()
        page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
        page.mouse.down();page.mouse.move(rect['x']+rect['width']/2+15,rect['y']+rect['height']/2+8,steps=4)
        page.wait_for_function("document.body.classList.contains('dragging-entry')")
        target=trash.bounding_box();page.mouse.move(target['x']+target['width']/2,target['y']+target['height']/2,steps=10);page.mouse.up()
    default=window.bounding_box();menu=page.locator('.menubar').bounding_box()
    def assert_footer():
        win=window.bounding_box();foot=footer.bounding_box()
        assert abs(foot['y']+foot['height']-(win['y']+win['height']-2))<3,(win,foot)
        assert foot['y']>=win['y'] and foot['y']+foot['height']<=900
    assert_footer()
    bar.focus();bar.press('ArrowRight');bar.press('ArrowDown')
    before=window.bounding_box()
    page.get_by_role('button',name='Maximize window',exact=True).click()
    full=window.bounding_box()
    assert abs(full['x'])<1 and abs(full['width']-1280)<1 and abs(full['y']-(menu['y']+menu['height']))<1
    assert abs(full['y']+full['height']-900)<1
    assert_footer()
    page.get_by_role('button',name='Restore window',exact=True).click()
    after=window.bounding_box()
    for field in ('x','y','width','height'):assert abs(before[field]-after[field])<2,(before,after)
    # Shrink the actual browser resize handle; status chrome stays inside the frame.
    rect=window.bounding_box();page.mouse.move(rect['x']+rect['width']-5,rect['y']+rect['height']-5);page.mouse.down();page.mouse.move(rect['x']+rect['width']-115,rect['y']+rect['height']-155,steps=6);page.mouse.up()
    resized=window.bounding_box();assert resized['height']<rect['height'];assert_footer()
    page.get_by_role('button',name='Maximize window',exact=True).click();assert_footer()
    page.get_by_role('button',name='Restore window',exact=True).click()
    restored=window.bounding_box()
    for field in ('x','y','width','height'):assert abs(resized[field]-restored[field])<2
    # Enlarge past viewport bounds; CSS limits keep the footer on screen.
    rect=window.bounding_box();page.mouse.move(rect['x']+rect['width']-5,rect['y']+rect['height']-5);page.mouse.down();page.mouse.move(rect['x']+rect['width']+200,1200,steps=8);page.mouse.up();assert_footer()
    page.locator('.detail').evaluate('(el)=>el.scrollTop=el.scrollHeight');assert_footer()
    # Future icons fill downward, then another column to the left.
    page.evaluate("""()=>{const icons=document.querySelector('#desktop-icons');const rows=Number(getComputedStyle(document.documentElement).getPropertyValue('--desktop-rows'));for(let i=0;i<=rows;i++){const el=document.createElement('button');el.className='desktop-icon test-icon';el.textContent='Test '+i;icons.append(el);}}""")
    first=page.locator('#bhr-icon').bounding_box();second=page.locator('.test-icon').first.bounding_box()
    assert abs(first['x']-second['x'])<1 and second['y']>first['y']
    left=page.locator('.test-icon').last.bounding_box();assert left['x']<first['x']
    page.locator('.test-icon').evaluate_all('(nodes)=>nodes.forEach(node=>node.remove())')
    drag_to_trash(page.locator('.note').first)
    confirm=page.locator('#trash-dialog')
    assert confirm.get_by_text('ARE YOU SURE YOU WANT TO PERMANENTLY DELETE THIS ENTRY?',exact=True).is_visible()
    confirm.get_by_role('button',name='Cancel',exact=True).click()
    assert page.locator('.note').count()==1
    # Drop while maximized: trash comes to the foreground only during drag.
    page.get_by_role('button',name='Maximize window',exact=True).click()
    drag_to_trash(page.locator('.note').first)
    confirm.get_by_role('button',name='Permanently delete',exact=True).click()
    assert page.locator('.note').count()==0
    saved=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1'))")
    assert saved['deleted']['notes']==[{'personId':'a','noteId':'note-a'}]
    drag_to_trash(page.locator('.person').filter(has_text='Beta Test'))
    confirm.get_by_role('button',name='Permanently delete',exact=True).click()
    assert page.locator('.person').count()==1
    open_drive(page);page.locator('#google-connect').click();page.locator('#use-drive-root').click();page.locator('#sync').click()
    page.wait_for_function("document.querySelector('#drive-status').textContent.startsWith('Synced.')")
    assert uploads and len(uploads[-1]['people'])==1 and uploads[-1]['people'][0]['notes']==[]
    assert uploads[-1]['deleted']['people']==['b']
    page.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    page.reload()
    unlock_test_drive(page,profile=True)
    assert page.locator('.person').count()==1 and page.locator('.note').count()==0
    # Keyboard/tap alternative selects an entry then uses the same confirmation.
    page.locator('.person').first.focus();page.locator('.person').first.press('Delete')
    assert confirm.is_visible();confirm.get_by_role('button',name='Cancel',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    page.get_by_role('button',name='Restore window',exact=True).click() if page.locator('.window.maximized').count() else None
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('.person').first.click();trash.click();assert confirm.is_visible();confirm.get_by_role('button',name='Cancel',exact=True).click()
    assert not errors,errors
    b.close()
    print('PASS: maximize fills below menu; previous/custom geometry restored; footer pinned through resize; top-right desktop grid; drag cancel/confirm; maximized trash drop; person/note deletion; stale Drive copy cannot resurrect entries; keyboard and mobile alternatives')
