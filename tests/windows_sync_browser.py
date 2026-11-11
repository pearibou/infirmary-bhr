from browser_helpers import prepare_test_page,unlock_test_drive,open_drive,fill_death_date
"""Age, window controls and timed sync with a mocked Google backend."""
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':900},service_workers='block')
    page.clock.install()
    data={'version':1,'people':[{'id':'p1','name':'Test Brother','info':'','updatedAt':'2026-01-01T00:00:00Z','birthDate':{'month':'1','day':'1','year':'1940'},'notes':[]}]}
    page.add_init_script("localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(data))+");"+"""
      window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:'test',expires_in:3600})})}}};
    """)
    uploads=[]
    pending=[]
    hold_first=[True]
    def drive(route):
        url=route.request.url
        if '/upload/' in url:
            uploads.append(json.loads(route.request.post_data))
            route.fulfill(json={'id':'file'})
        elif 'files/root?' in url:
            route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
        elif 'alt=media' in url:
            if hold_first[0]:
                hold_first[0]=False
                pending.append(route)
            else:
                route.fulfill(json=data)
        else:
            route.fulfill(json={'files':[{'id':'file'}]})
    page.route('https://www.googleapis.com/**',drive)
    page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body="window.INFIRMARY_CONFIG={clientId:'test.apps.googleusercontent.com'}"))
    page.route('https://www.googleapis.com/oauth2/v3/userinfo',lambda route:route.fulfill(json={'sub':'synthetic-staff','name':'Synthetic Staff'}))
    prepare_test_page(page)
    page.goto('http://127.0.0.1:8000')
    unlock_test_drive(page,profile=True)
    assert 'y.o.' in page.locator('.age').inner_text()
    window=page.locator('.window')
    original=window.bounding_box()
    title=page.locator('.titlebar')
    title.focus()
    title.press('ArrowRight')
    assert window.bounding_box()['x']>original['x']
    page.get_by_role('button',name='Minimize Brother Health Records',exact=True).click()
    assert not window.is_visible()
    page.locator('#window-dock button').click()
    assert window.is_visible()
    page.get_by_role('button',name='Maximize window',exact=True).click()
    page.get_by_role('button',name='Restore window',exact=True).click()
    assert window.bounding_box()['x']>original['x']
    assert window.evaluate('(el)=>getComputedStyle(el).resize')=='both'
    rect=window.bounding_box()
    page.mouse.move(rect['x']+rect['width']-5,rect['y']+rect['height']-5)
    page.mouse.down()
    page.mouse.move(rect['x']+rect['width']-75,rect['y']+rect['height']-65,steps=5)
    page.mouse.up()
    assert window.bounding_box()['width']<rect['width']
    page.get_by_role('button',name='Maximize window',exact=True).click()
    page.get_by_role('button',name='Restore window',exact=True).click()
    page.locator('#add-person').click()
    page.get_by_label('Minimize New person',exact=True).click()
    assert not page.locator('#person-dialog').is_visible()
    page.locator('#window-dock button').click()
    assert page.locator('#person-dialog').is_visible()
    page.locator('#person-dialog').get_by_role('button',name='Cancel').click()
    with page.expect_request(lambda request:'alt=media' in request.url):
        page.locator('#manual-sync').click()
    page.get_by_label('New note').fill('Note added during sync')
    page.get_by_label('New note').press('Enter')
    page.get_by_label('New note').fill('Keep this unsent draft')
    assert pending
    pending[0].fulfill(json=data)
    page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    assert len(uploads)==1
    assert page.get_by_label('New note').input_value()=='Keep this unsent draft'
    page.clock.fast_forward(10000)
    page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    assert len(uploads)==2
    assert uploads[1]['people'][0]['notes'][0]['text']=='Note added during sync'
    open_drive(page)
    page.locator('#disconnect').click()
    page.clock.fast_forward(10000)
    assert len(uploads)==2
    b.close()
    print('PASS: age shown; window movement/minimize/maximize/restore/resize; dialog minimize; manual sync; 10-second autosync; draft retention; disconnect stops autosync')
