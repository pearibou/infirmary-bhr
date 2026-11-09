"""Application menu actions, keyboard navigation and mobile layout."""
from playwright.sync_api import sync_playwright
import json,subprocess
from pathlib import Path
from browser_helpers import prepare_test_page,unlock_test_drive
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block')
    prepare_test_page(page)
    page.goto('http://localhost:8000')
    unlock_test_drive(page)
    presence=page.locator('#connected-users')
    assert presence.inner_text()=='Connected Users: 1'
    presence.click();assert page.locator('#connected-users-pane').is_visible()
    assert page.locator('#connected-users-list').inner_text()=='Synthetic Staff (synthetic-staff@example.test)'
    page.keyboard.press('Escape');assert not page.locator('#connected-users-pane').is_visible()
    # Provider seam accepts future shared presence, deduplicates identities and
    # ignores stale callbacks after replacing a provider.
    page.evaluate("""async()=>{
        const presence=await import('./presence.js?v=0.24.0');
        window.presenceModule=presence;
        presence.setPresenceProvider({subscribe:cb=>{window.oldPresence=cb;cb([{id:'a',name:'Synthetic One'},{id:'a',name:'Synthetic One'},{id:'b',name:'Synthetic Two',email:'two@example.test'}]);return ()=>window.presenceStopped=true;}});
    }""")
    assert presence.inner_text()=='Connected Users: 2'
    assert 'Synthetic Two (two@example.test)' in page.locator('#connected-users-list').inner_text()
    page.evaluate("presenceModule.setPresenceProvider(null);oldPresence([{id:'stale',name:'Stale'}])")
    assert presence.inner_text()=='Connected Users: 1'
    assert page.evaluate('presenceStopped')
    account=page.locator('#account-toggle');account_pane=page.locator('#account-pane')
    assert account.bounding_box()['x']<page.locator('#logout-power').bounding_box()['x']
    account.click();assert account_pane.is_visible()
    assert page.locator('#account-email').inner_text()=='synthetic-staff@example.test' and page.locator('#account-display-name').inner_text()=='Synthetic Staff'
    page.keyboard.press('Escape');assert account_pane.is_hidden()
    account.focus();page.keyboard.press('ArrowDown');assert page.locator('#account-edit-name').evaluate('n=>n===document.activeElement')
    page.keyboard.press('Enter');assert account_pane.is_hidden() and page.locator('#drive-dialog').is_visible() and page.locator('#staff-profile-panel').is_visible()
    assert page.locator('#staff-display-name').input_value()=='Synthetic Staff'
    page.locator('#drive-dialog [data-close]').click()
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
    assert page.locator('#drive-dialog').evaluate("e=>e.classList.contains('drive-connected') && getComputedStyle(e).outlineWidth==='5px'")
    assert page.locator('#drive-connection-badge').inner_text()=='● Connected to Google Drive'
    page.locator('#drive-dialog [data-close]').click()
    toggle.click();page.locator('.abbey-mark').click();assert not menu.is_visible()
    # Larger artwork stays inside the same desktop grid cell.
    assert page.locator('#bhr-icon').bounding_box()['width']==88
    assert page.locator('#bhr-icon img').bounding_box()['width']==56
    assert page.locator('#calendar-maker-icon img').bounding_box()['width']==44
    toggle.click();assert menu.get_by_role('menuitem').last.inner_text()=='About…'
    menu.get_by_role('menuitem').first.focus();page.keyboard.press('End');assert page.locator('#about-open').evaluate('e=>e===document.activeElement');page.keyboard.press('Enter')
    about=page.locator('#about-dialog');assert about.is_visible() and menu.is_hidden()
    assert 'Brother Health Records System' in about.inner_text() and '© Mepkin Abbey 2026' in about.inner_text()
    version=json.loads(Path('package.json').read_text())['version'];assert page.locator('#about-version').inner_text()=='Version '+version
    assert about.locator('img').get_attribute('src')==page.locator('.abbey-mark').get_attribute('src') and about.locator('img').bounding_box()['width']==120
    about.locator('img').evaluate('i=>i.decode()');about.screenshot(path='/tmp/bhr-about.png')
    page.pdf(path='/tmp/bhr-about.pdf',format='Letter');printed=subprocess.check_output(['pdftotext','/tmp/bhr-about.pdf','-'],text=True)
    assert 'Brother Health Records System' in ' '.join(printed.split()) and 'Directory' not in printed and 'Google Drive' not in printed
    about.get_by_role('button',name='Close',exact=True).click();assert about.is_hidden()
    for width in [1280,960,820,701,700,390,320]:
        page.set_viewport_size({'width':width,'height':900})
        account.click();assert account_pane.is_visible()
        if width in [1280,390]:page.locator('.menubar').screenshot(path=f'/tmp/bhr-account-menu-{width}.png')
        rect=account_pane.bounding_box();assert rect['x']>=0 and rect['x']+rect['width']<=width
        assert abs(account.bounding_box()['y']-page.locator('#logout-power').bounding_box()['y'])<5
        page.keyboard.press('Escape')
        toggle.click();assert menu.is_visible()
        box=menu.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.keyboard.press('Escape')
        toggle.click();page.locator('#about-open').click();assert about.is_visible() and page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.keyboard.press('Escape');assert about.is_hidden()
    browser.close()
print('Application menu checks passed')
