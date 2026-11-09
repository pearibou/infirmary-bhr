"""Synthetic end-to-end startup gate, partial death dates, collapse and cross-user handoff."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,open_drive,ignore_event_log_projection
import copy
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    cloud={'version':1,'people':[{'id':'living','name':'Living Test','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]},{'id':'dead','name':'Deceased Test','info':'','deceased':True,'deathDate':'2020-01-01','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
    backend={'data':cloud};fail=[True]
    def setup(name):
        context=browser.new_context(viewport={'width':1280,'height':900},service_workers='block');page=context.new_page();prepare_test_page(page)
        page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body="window.INFIRMARY_CONFIG={clientId:'test.apps.googleusercontent.com'}"))
        def api(route):
            url=route.request.url
            if '/oauth2/' in url:route.fulfill(json={'sub':name,'name':name})
            elif fail[0]:route.fulfill(status=500,json={'error':{'message':'Synthetic backend failure'}})
            elif route.request.method=='PATCH':backend['data']=copy.deepcopy(route.request.post_data_json);route.fulfill(json={'id':'directory'})
            elif 'alt=media' in url:route.fulfill(json=backend['data'])
            elif 'files?q=' in url:route.fulfill(json={'files':[{'id':'directory'}]})
            else:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
        page.route('https://www.googleapis.com/**',api);ignore_event_log_projection(page);page.goto('http://127.0.0.1:8000');return context,page
    context,a=setup('Synthetic Staff A')
    assert a.locator('#drive-dialog').is_visible() and a.locator('.desktop').evaluate('el=>el.inert')
    assert a.locator('#drive-dialog [data-close]').is_disabled()
    a.keyboard.press('Escape');assert a.locator('#drive-dialog').is_visible()
    a.locator('#google-connect').click();a.locator('#use-drive-root').click()
    a.wait_for_function("document.querySelector('#drive-status').textContent.includes('Synthetic backend failure')")
    assert a.locator('body').evaluate("el=>el.classList.contains('drive-locked')")
    fail[0]=False;a.locator('#sync').click()
    a.wait_for_function("!document.body.classList.contains('drive-locked')")
    a.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    a.get_by_role('button',name='Hide deceased people').click();assert a.locator('.deceased-row').count()==0
    a.get_by_role('button',name='Show deceased people').click();assert a.locator('.deceased-row').count()==1
    a.locator('.person').filter(has_text='Deceased Test').click();a.get_by_role('button',name='Edit this record').click()
    form=a.locator('#person-dialog')
    for label in ('Death month','Death day','Death year'):form.get_by_label(label,exact=True).fill('')
    form.get_by_label('Death day',exact=True).fill('5');a.locator('#person-submit').click();assert 'day needs a month' in a.locator('#person-error').inner_text()
    form.get_by_label('Death day',exact=True).fill('');form.get_by_label('Death month',exact=True).fill('5');a.locator('#person-submit').click()
    assert a.locator('.death-status').inner_text()=='Date of death: May'
    a.get_by_role('button',name='Edit this record').click();form.get_by_label('Death month',exact=True).fill('');form.get_by_label('Death year',exact=True).fill('2020');a.locator('#person-submit').click()
    assert a.locator('.death-status').inner_text()=='Date of death: 2020'
    a.get_by_role('button',name='Edit this record').click();form.get_by_label('Death month',exact=True).fill('5');a.locator('#person-submit').click()
    assert a.locator('.death-status').inner_text()=='Date of death: May 2020'
    a.get_by_role('button',name='Hide deceased people').click()
    top=a.locator('.menubar').bounding_box()['height']
    a.mouse.click(15,top+15,button='right');assert a.locator('#desktop-context-menu').is_visible()
    a.get_by_role('menuitem',name='New Sticky Note').click();a.locator('#sticky-text').fill('Synthetic handoff <script>safe text</script>');a.get_by_role('button',name='Leave note',exact=True).click()
    a.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    assert backend['data']['desktopNotes'][0]['text']=='Synthetic handoff <script>safe text</script>'
    card=a.locator('.sticky-note');assert card.is_visible() and '<script>' in card.inner_text()
    assert card.evaluate('(el)=>getComputedStyle(el).backgroundColor')=='rgb(255, 243, 166)'
    rect=card.bounding_box();a.mouse.move(rect['x']+60,rect['y']+20);a.mouse.down();a.mouse.move(rect['x']+80,rect['y']+25,steps=4);a.mouse.move(440,top+150,steps=10);a.mouse.up()
    assert card.bounding_box()['x']>200
    a.locator('#manual-sync').click();a.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    context2,b=setup('Synthetic Staff B');b.locator('#google-connect').click();b.locator('#use-drive-root').click();b.wait_for_function("!document.body.classList.contains('drive-locked')");b.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    assert b.locator('.sticky-note').is_visible() and 'Synthetic Staff A' in b.locator('.sticky-note').inner_text()
    # Any connected staff member can edit a shared sticky, draw, or minimize locally.
    b.locator('.sticky-note .sticky-edit').click();b.locator('#sticky-text').fill('Synthetic revised handoff')
    b.locator('#sticky-draw-toggle').click();assert b.locator('#sticky-draw-toggle').get_attribute('aria-pressed')=='true' and b.locator('#sticky-palette').is_visible()
    b.locator('#sticky-ink').select_option('#2454a4');b.locator('#sticky-brush').select_option('5')
    canvas=b.locator('#sticky-canvas');r=canvas.bounding_box();b.mouse.move(r['x']+20,r['y']+35);b.mouse.down();b.mouse.move(r['x']+120,r['y']+65,steps=8);b.mouse.up()
    b.set_viewport_size({'width':390,'height':844});assert b.evaluate('document.documentElement.scrollWidth<=innerWidth');assert b.locator('#sticky-palette').bounding_box()['x']>=0
    b.locator('#sticky-dialog').screenshot(path='/tmp/bhr-sticky-drawing-editor.png');b.set_viewport_size({'width':1280,'height':900})
    b.locator('#sticky-submit').click();b.wait_for_function("!document.querySelector('#sticky-dialog').open && document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    saved=backend['data']['desktopNotes'][0];assert saved['text']=='Synthetic revised handoff' and saved['drawing'][0]['color']=='#2454a4' and saved['authorName']=='Synthetic Staff A' and saved['editedBy']=='Synthetic Staff B'
    assert b.locator('.sticky-card-drawing').is_visible()
    b.locator('.sticky-note').click(button='right');b.get_by_role('menuitem',name='Minimize note',exact=True).click()
    assert b.locator('.sticky-note').count()==0 and b.locator('#sticky-dock button').count()==1
    minimized=b.locator('#sticky-dock button').bounding_box();bar=b.locator('.menubar').bounding_box();assert abs(minimized['y']-(bar['y']+bar['height']))<2
    b.locator('#manual-sync').click();b.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'");assert b.locator('.sticky-note').count()==0
    b.locator('#sticky-dock button').click();b.locator('.sticky-note').dblclick();assert b.locator('#sticky-text').input_value()=='Synthetic revised handoff'
    b.locator('#sticky-draw-toggle').click();b.locator('#sticky-undo').click();b.locator('#sticky-dialog [data-close]').click()
    b.locator('.sticky-note .sticky-edit').click();assert b.locator('#sticky-canvas').evaluate("c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((n,i)=>i%4===3&&n>0)")
    b.locator('#sticky-dialog [data-close]').click()
    a.locator('#manual-sync').click();a.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'");assert 'Synthetic revised handoff' in a.locator('.sticky-note').inner_text() and a.locator('.sticky-card-drawing').count()==1
    b.locator('.sticky-note').click(button='right');b.get_by_role('menuitem',name='Trash (delete) note…',exact=True).click();b.locator('#trash-dialog [data-close]').click();assert b.locator('.sticky-note').count()==1
    b.locator('.sticky-note').drag_to(b.locator('#desktop-trash'));b.locator('#trash-dialog').get_by_role('button',name='Permanently delete',exact=True).click()
    assert b.locator('.sticky-note').count()==0
    b.locator('#manual-sync').click();b.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    a.locator('#manual-sync').click();a.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    assert a.locator('.sticky-note').count()==0
    a.reload();assert a.locator('#drive-dialog').is_visible() and a.locator('.desktop').evaluate('el=>el.inert')
    a.locator('#google-connect').click();a.wait_for_function("!document.body.classList.contains('drive-locked')");a.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    assert a.locator('.deceased-row').count()==0 and a.get_by_role('button',name='Show deceased people').is_visible()
    open_drive(a);a.locator('#disconnect').click();assert a.locator('body').evaluate("el=>el.classList.contains('drive-locked')")
    a.keyboard.press('Escape');assert a.locator('#drive-dialog').is_visible()
    browser.close()
    print('PASS: hard startup/sync-failure/escape/reload/disconnect gate; partial death date precision; collapsible persistent deceased section; desktop menu; pastel shared notes; movement; cross-user Drive handoff; trash deletion sync')
