"""Synthetic end-to-end startup gate, partial death dates, collapse and cross-user handoff."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,open_drive
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
            else:route.fulfill(json={'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
        page.route('https://www.googleapis.com/**',api);page.goto('http://127.0.0.1:8000');return context,page
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
    a.get_by_role('menuitem',name='New note').click();a.locator('#sticky-text').fill('Synthetic handoff <script>safe text</script>');a.get_by_role('button',name='Leave note',exact=True).click()
    a.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    assert backend['data']['desktopNotes'][0]['text']=='Synthetic handoff <script>safe text</script>'
    card=a.locator('.sticky-note');assert card.is_visible() and '<script>' in card.inner_text()
    assert card.evaluate('(el)=>getComputedStyle(el).backgroundColor')=='rgb(255, 243, 166)'
    rect=card.bounding_box();a.mouse.move(rect['x']+60,rect['y']+20);a.mouse.down();a.mouse.move(rect['x']+80,rect['y']+25,steps=4);a.mouse.move(440,top+150,steps=10);a.mouse.up()
    assert card.bounding_box()['x']>200
    a.locator('#manual-sync').click();a.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    context2,b=setup('Synthetic Staff B');b.locator('#google-connect').click();b.locator('#use-drive-root').click();b.wait_for_function("!document.body.classList.contains('drive-locked')");b.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    assert b.locator('.sticky-note').is_visible() and 'Synthetic Staff A' in b.locator('.sticky-note').inner_text()
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
