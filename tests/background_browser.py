"""Device-only background preference, no real account or protected data."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
    page.route('https://www.googleapis.com/drive/v3/files/root?*',lambda route:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}}))
    directory=[{'version':1,'people':[]}]
    page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[{'id':'__test-bootstrap'}] if 'people_directory.json' in route.request.url else []}))
    page.route('https://www.googleapis.com/drive/v3/files/__test-bootstrap?*',lambda route:route.fulfill(json=directory[0]))
    def write(route):directory[0]=route.request.post_data_json;route.fulfill(json={'id':'__test-bootstrap'})
    page.route('https://www.googleapis.com/upload/drive/v3/files/__test-bootstrap?*',write)
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    desktop=page.locator('.desktop');original=desktop.evaluate('el=>getComputedStyle(el).backgroundImage');assert '135, 164, 191' in original and 'repeating-conic-gradient' in original
    def open_color():
        desktop.click(button='right',position={'x':16,'y':30});page.get_by_role('menuitem',name='Change background color…').click()
    open_color();assert page.locator('#background-color').input_value()=='#8ca9c4'
    page.locator('[data-background="#b7adc8"]').click();assert desktop.evaluate('el=>getComputedStyle(el).backgroundImage')!=original
    page.locator('#background-dialog [data-close]').click();assert desktop.evaluate('el=>getComputedStyle(el).backgroundImage')==original
    open_color();page.locator('#background-color').fill('#aabbcc');page.locator('#background-form button[type=submit]').click()
    assert page.evaluate("localStorage.getItem('infirmary.backgroundColor')")=='#aabbcc'
    chosen=desktop.evaluate('el=>getComputedStyle(el).backgroundImage');assert '165, 182, 199' in chosen
    assert desktop.evaluate('el=>getComputedStyle(el).backgroundSize')=='4px 4px'
    page.reload();assert desktop.evaluate('el=>getComputedStyle(el).backgroundImage')==chosen
    unlock_test_drive(page);open_color();page.locator('[data-background="#909090"]').click();page.keyboard.press('Escape');assert desktop.evaluate('el=>getComputedStyle(el).backgroundImage')==chosen
    page.set_viewport_size({'width':390,'height':844});open_color();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.keyboard.press('Escape')
    page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.evaluate("localStorage.getItem('infirmary.backgroundColor')")=='#aabbcc'
    assert not errors,errors
    browser.close()
print('PASS: French Blue default; original texture; native custom color; preview/cancel/Escape; Apply persists across reload/logout; mobile context menu')
