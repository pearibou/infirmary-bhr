"""Synthetic UI/session test: logout confirmation, cancel, abort and responsive placement."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
import json
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':900},service_workers='block');page=context.new_page();prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'version':1,'people':[{'id':'person','name':'Synthetic Brother','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
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
    # Keep an actual sync pending when confirming logout. It must not reopen the workspace.
    pending=[]
    page.route('https://www.googleapis.com/drive/v3/files/root?*',lambda route:pending.append(route))
    page.locator('#manual-sync').click();page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='true'")
    power.click();dialog.get_by_role('button',name='Log out',exact=True).click()
    page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.locator('#drive-dialog').is_visible()
    assert page.locator('#drive-dialog [data-close]').is_disabled()
    assert page.locator('.desktop').evaluate('el=>el.inert')
    assert power.is_disabled()
    assert page.get_by_label('New note',exact=True).input_value()==''
    events=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).eventLog")
    assert any(event['action']=='session.logged_out' and event['actorId']=='synthetic-staff' for event in events)
    for route in pending:route.fulfill(json={'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
    page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    assert 'Logged out.' in page.locator('#drive-status').inner_text()
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
    print('PASS: power right of clock at desktop/tablet/mobile widths; dimmed two-choice dialog; Cancel/Escape preserve session; logout clears draft, records actor and locks workspace; pending sync cannot unlock it')
