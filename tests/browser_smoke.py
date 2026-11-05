"""Run against npm start. Requires Python Playwright and Chromium."""
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':900})
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:8000')
    page.locator('#add-person').click()
    page.get_by_label('Preferred name').fill('Brother Test')
    page.get_by_label('Additional information').fill('Test entry only')
    page.locator('#person-dialog').get_by_role('button',name='Add person',exact=True).click()
    page.get_by_label('New note').fill('First observation <script>alert(1)</script>')
    page.get_by_label('New note').press('Enter')
    page.get_by_label('New note').fill('Second observation')
    page.get_by_label('New note').press('Enter')
    assert page.locator('.note').count()==2
    assert '<script>' in page.locator('.note').first.inner_text()
    page.reload()
    assert page.locator('.note').count()==2
    page.locator('#search').fill('missing')
    assert page.get_by_text('No matching people.').is_visible()
    page.locator('#search').fill('')
    page.screenshot(path='artifacts/desktop.png',full_page=True)
    page.evaluate('navigator.serviceWorker.ready')
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    context.set_offline(True)
    page.reload()
    assert page.locator('.note').count()==2
    page.get_by_label('New note').fill('Offline observation')
    page.get_by_label('New note').press('Enter')
    assert page.locator('.note').count()==3
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='artifacts/mobile.png',full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS: create person; append notes; safe text rendering; reload persistence; search; offline reload and note entry; mobile width; no browser errors')
