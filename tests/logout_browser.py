"""Synthetic UI/session test: logout confirmation, cancel, abort and responsive placement."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
import json
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':900},service_workers='block');page=context.new_page();prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'version':1,'people':[{'id':'person','name':'Synthetic Brother','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
    page.add_init_script("if(!sessionStorage.getItem('synthetic-seeded')){sessionStorage.setItem('synthetic-seeded','1');if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");}")
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    power=page.locator('#logout-power');clock=page.locator('#clock')
    for width in (1280,1100,1000,960,901,820,390,320):
        page.set_viewport_size({'width':width,'height':900})
        btn=power.bounding_box();time=clock.bounding_box()
        assert btn['x']>=time['x']+time['width']-1,(width,btn,time)
        assert btn['x']+btn['width']<=width
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.set_viewport_size({'width':1280,'height':900})
    page.get_by_label('New note',exact=True).fill('Synthetic unsent draft')
    power.click();dialog=page.locator('#logout-dialog')
    assert dialog.is_visible() and dialog.get_by_text('Do you want to log out?',exact=True).is_visible()
    assert dialog.locator('button').count()==2
    assert dialog.evaluate("el=>getComputedStyle(el,'::backdrop').backgroundColor")=='rgba(0, 0, 0, 0.55)'
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    assert not page.locator('body').evaluate("el=>el.classList.contains('drive-locked')")
    assert page.get_by_label('New note',exact=True).input_value()=='Synthetic unsent draft'
    power.click();page.keyboard.press('Escape');assert not dialog.is_visible()
    # Failed final sync retains the authenticated session and permits retry.
    # UI/logout fixture; real Drive presence is covered by shared_presence_browser.py.
    page.evaluate("async()=>{const presence=await import('./presence.js?v=0.29.0');presence.setPresenceProvider({subscribe:cb=>{cb([{id:'synthetic-staff',name:'Synthetic Staff'}]);return ()=>{};}})}")
    assert page.locator('#connected-users').inner_text()=='Connected Users: 1'
    page.locator('#connected-users').click()
    assert page.locator('#connected-users-list').inner_text()=='Synthetic Staff'
    power.click()
    page.route('https://www.googleapis.com/drive/v3/files/root?*',lambda route:route.fulfill(status=503,json={'error':{'message':'Synthetic outage'}}))
    dialog.get_by_role('button',name='Log out',exact=True).click()
    page.wait_for_function("document.querySelector('#logout-status').textContent.includes('still signed in')")
    assert not page.locator('body').evaluate("el=>el.classList.contains('drive-locked')")
    assert page.get_by_label('New note',exact=True).input_value()=='Synthetic unsent draft'
    assert page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people.length")==1
    page.unroute('https://www.googleapis.com/drive/v3/files/root?*')
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    # Hold an older sync; logout must wait for it and then upload a fresh snapshot.
    pending=[];writes=[]
    page.route('https://www.googleapis.com/drive/v3/files/root?*',lambda route:pending.append(route))
    page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[] if 'BHR_event_log.txt' in route.request.url else [{'id':'logout-test'}]}))
    page.route('https://www.googleapis.com/drive/v3/files/logout-test?*',lambda route:route.fulfill(json=seed))
    def write(route):
        writes.append(route.request.post_data_json)
        route.fulfill(json={'id':'logout-test'})
    page.route('https://www.googleapis.com/upload/drive/v3/files/logout-test?*',write)
    page.locator('#manual-sync').click()
    page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='true'")
    page.get_by_label('New note',exact=True).fill('Synthetic latest saved note')
    page.get_by_label('New note',exact=True).press('Enter')
    other=context.new_page();prepare_test_page(other);other.goto('http://127.0.0.1:8000')
    other.wait_for_function("document.querySelector('#people').textContent.includes('Synthetic Brother')")
    page.evaluate("localStorage.setItem('infirmary.deceasedCollapsed','true');localStorage.setItem('unrelated-preference','keep')")
    power.click();dialog.get_by_role('button',name='Log out',exact=True).click()
    assert dialog.get_by_role('button',name='Cancel',exact=True).is_disabled()
    assert not page.locator('body').evaluate("el=>el.classList.contains('drive-locked')")
    page.keyboard.press('Escape');assert dialog.is_visible()
    page.wait_for_timeout(100)
    assert len(pending)==1
    pending[0].fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
    for _ in range(100):
        page.wait_for_timeout(50)
        if len(pending)>1:break
    assert len(pending)==2
    assert not page.locator('body').evaluate("el=>el.classList.contains('drive-locked')")
    pending[1].fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
    page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert len(writes)==2
    assert any(note['text']=='Synthetic latest saved note' for note in writes[-1]['people'][0]['notes'])
    assert page.locator('#connected-users').inner_text()=='Connected Users: 0'
    assert page.locator('#drive-dialog').is_visible()
    assert page.locator('#drive-dialog [data-close]').is_disabled()
    assert page.locator('.desktop').evaluate('el=>el.inert')
    assert power.is_disabled()
    assert page.locator('.note-form').count()==0
    assert page.evaluate("localStorage.getItem('infirmary.directory.v1')") is None
    assert page.evaluate("localStorage.getItem('infirmary.drive')") is None
    assert page.evaluate("localStorage.getItem('infirmary.deceasedCollapsed')")=='true'
    assert page.evaluate("localStorage.getItem('unrelated-preference')")=='keep'
    assert 'Synthetic' not in page.locator('body').text_content()
    assert page.locator('#person-photo-preview img').count()==0
    assert page.locator('#event-log-text').inner_text()=='No events recorded yet.'
    assert page.locator('#people-count').text_content()=='0 people in directory'
    other.wait_for_function("!document.querySelector('#people').textContent.includes('Synthetic Brother')")
    assert 'Synthetic' not in other.locator('body').text_content()
    assert other.locator('#drive-dialog').is_visible()
    events=writes[-1]['eventLog']
    assert any(event['action']=='session.logout_requested' and event['actorId']=='synthetic-staff' for event in events)
    other.close()
    page.reload()
    page.wait_for_function("document.querySelector('#drive-dialog').open")
    assert page.evaluate("localStorage.getItem('infirmary.directory.v1')") is None
    assert 'Synthetic Brother' not in page.locator('body').text_content()
    # A delayed OAuth result after disconnect must also be discarded.
    page.evaluate("google.accounts.oauth2.initTokenClient=opts=>({requestAccessToken:()=>window.pendingAuth=opts.callback})")
    page.locator('#google-connect').click()
    page.locator('#disconnect').click()
    page.evaluate("window.pendingAuth({access_token:'late-synthetic-token',expires_in:3600})")
    page.wait_for_function("!document.querySelector('#google-connect').disabled")
    assert page.locator('body').evaluate("el=>el.classList.contains('drive-locked')")
    assert power.is_disabled()
    assert not errors,errors
    browser.close()
    print('PASS: power right of clock at desktop/tablet/mobile widths; dimmed two-choice dialog; Cancel/Escape preserve session; logout clears protected storage/DOM across tabs and reload; final upload includes logout actor; failed sync retains session; pending sync is awaited before fresh final sync')
