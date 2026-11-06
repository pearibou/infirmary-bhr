"""Application menu actions, keyboard navigation and mobile layout."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block')
    prepare_test_page(page)
    page.goto('http://localhost:8000')
    unlock_test_drive(page)
    toggle=page.locator('#app-menu-toggle');menu=page.locator('#app-menu')
    assert not menu.is_visible()
    toggle.click();assert menu.is_visible()
    assert toggle.get_attribute('aria-expanded')=='true'
    page.keyboard.press('Escape');assert not menu.is_visible()
    toggle.focus();page.keyboard.press('ArrowDown')
    assert page.locator('#drive-open').evaluate('el=>el===document.activeElement')
    page.keyboard.press('ArrowDown')
    assert page.locator('#export').evaluate('el=>el===document.activeElement')
    with page.expect_download() as download:page.keyboard.press('Enter')
    assert download.value.suggested_filename=='people_directory.json'
    assert not menu.is_visible()
    toggle.click();page.locator('#drive-open').click()
    assert page.locator('#drive-dialog').is_visible() and not menu.is_visible()
    page.locator('#drive-dialog [data-close]').click()
    toggle.click();page.locator('.abbey-mark').click();assert not menu.is_visible()
    for width in [1280,960,700,390,320]:
        page.set_viewport_size({'width':width,'height':900})
        toggle.click();assert menu.is_visible()
        box=menu.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.keyboard.press('Escape')
    browser.close()
print('Application menu checks passed')
