"""End-to-end browser test against a running server with demo data.
Usage: BASE_URL=http://127.0.0.1:3000/ OUT=./e2e-out python3 e2e/e2e_test.py
Covers the §17 acceptance areas: login/RBAC, profiles, documents, renewal & history, leave workflow,
alerts, dashboards, search, AI permissions, audit, file validation, forced password change, phone layout."""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:3000/')
OUT = os.environ.get('OUT', './e2e-out').rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True)
errs, results = [], []


def check(name, cond):
    results.append(('PASS ' if cond else 'FAIL ') + name)


def login(pg, email, pw='Adroit@2026'):
    pg.goto(URL); pg.wait_for_selector('#login-email')
    pg.fill('#login-email', email); pg.fill('#login-pass', pw); pg.click('button[type=submit]')
    pg.wait_for_selector('.side', timeout=15000); pg.wait_for_timeout(300)


def go(pg, h):
    pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(600)


def logout(pg):
    pg.click('button[aria-label="Sign out"]'); pg.wait_for_selector('#login-email')


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={'width': 1400, 'height': 900}).new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'fonts.g' not in m.text and 'ERR_TUNNEL' not in m.text and '401' not in m.text and errs.append('CONSOLE ' + m.text[:200]))

    pg.goto(URL); pg.wait_for_selector('#login-email'); pg.screenshot(path=OUT + 'login.png')
    pg.fill('#login-email', 'gm@adroit.ae'); pg.fill('#login-pass', 'nope'); pg.click('button[type=submit]'); pg.wait_for_timeout(900)
    check('wrong password shows error', pg.locator('.error').count() == 1)

    # HR officer: renew a visa with a real PDF, history retained, viewer, file validation, leave review, new employee
    login(pg, 'nadeesha.perera@adroit.ae'); pg.screenshot(path=OUT + 'hr-home.png')
    go(pg, 'hr-employee.0115'); pg.click('.tab:has-text("Visa")'); pg.wait_for_timeout(300)
    hist_before = pg.locator('.hist tbody tr').count()
    pg.click('text=Renew · record new document'); pg.fill('#doc-ref', '201/2026/1234567')
    open('/tmp/test-visa.pdf', 'wb').write(b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
    pg.set_input_files('#doc-file', '/tmp/test-visa.pdf'); pg.click('.modal-foot .btn-primary'); pg.wait_for_timeout(1800)
    check('renewal saved', pg.locator('.modal').count() == 0)
    check('previous version kept in history', pg.locator('.hist tbody tr').count() == hist_before + 1)
    pg.click('.doc-thumb'); pg.wait_for_timeout(900); pg.screenshot(path=OUT + 'viewer.png')
    check('PDF opens in viewer', pg.locator('iframe.viewer-pdf').count() == 1); pg.keyboard.press('Escape')
    pg.click('text=Replace scan'); open('/tmp/bad.pdf', 'wb').write(b'not really a pdf')
    pg.set_input_files('#doc-file', '/tmp/bad.pdf'); pg.click('.modal-foot .btn-primary'); pg.wait_for_timeout(900)
    check('fake PDF rejected by server', pg.locator('.error').count() and 'not a supported file' in pg.locator('.error').inner_text())
    pg.keyboard.press('Escape')
    go(pg, 'hr-leave.queue'); n0 = pg.locator('text=Checked · send for approval').count()
    pg.click('text=Checked · send for approval >> nth=0'); pg.fill('#act-note', 'Record checked'); pg.click('.modal-foot .btn-primary'); pg.wait_for_timeout(1200)
    check('HR review sends request for approval', pg.locator('text=Checked · send for approval').count() == n0 - 1)
    go(pg, 'hr-new'); pg.fill('#ef-name', 'Test Person Alpha'); pg.fill('#ef-desig', 'Storekeeper'); pg.fill('#ef-joined', '2026-01-10')
    pg.fill('#ef-no-Passport', 'N7654321'); pg.fill('#ef-ex-Passport', '2031-05-01')
    pg.click('button:has-text("Create employee")'); pg.wait_for_timeout(1800)
    check('employee created with server-assigned number', 'hr-employee.' in pg.evaluate('location.hash') and pg.locator('h1:has-text("Test Person Alpha")').count() == 1)
    logout(pg)

    # Management: approve, attention centre, cross-module AI, notifications, audit, asset history
    login(pg, 'gm@adroit.ae'); pg.screenshot(path=OUT + 'gm-home.png', full_page=True)
    go(pg, 'hr-leave.queue'); a0 = pg.locator('.req button:has-text("Approve")').count()
    pg.click('.req button:has-text("Approve") >> nth=0'); pg.click('.modal-foot .btn-primary'); pg.wait_for_timeout(1200)
    check('management approves leave', pg.locator('.req button:has-text("Approve")').count() == a0 - 1)
    go(pg, 'attention'); pg.screenshot(path=OUT + 'attention.png')
    go(pg, 'assistant'); pg.click('.suggest button >> nth=0'); pg.wait_for_timeout(2000); pg.screenshot(path=OUT + 'ai.png')
    check('AI summarises HR and fleet together', pg.locator('.ai-section').count() == 2)
    go(pg, 'notifications'); pg.wait_for_timeout(600); pg.screenshot(path=OUT + 'notifications.png')
    check('management receives escalations / approvals', pg.locator('.notif-list li').count() > 0)
    go(pg, 'audit'); pg.wait_for_timeout(1000); pg.screenshot(path=OUT + 'audit.png')
    check('audit records the renewal', pg.locator('td:has-text("Employment Visa renewed")').count() > 0)
    check('audit records the document view', pg.locator('.act-view').count() > 0)
    go(pg, 'fleet-vehicle.0108'); pg.click('.tab:has-text("History")'); pg.wait_for_timeout(800)
    check('asset history loads', pg.locator('.timeline li').count() > 0)
    logout(pg)

    # Fleet officer: blocked from HR (UI and API); fleet HSE updates an action
    login(pg, 'suresh.pillai@adroit.ae'); go(pg, 'hr-employees')
    check('fleet user blocked from HR page', pg.locator("text=You don't have access").count() == 1)
    check('fleet user blocked from HR API (403)', pg.evaluate("fetch('/api/employees').then(r=>r.status)") == 403)
    logout(pg)
    login(pg, 'tariq.malik@adroit.ae'); go(pg, 'fleet-vehicle.0108'); pg.click('.tab:has-text("Safety")'); pg.wait_for_timeout(300)
    pg.click('text=Update action'); pg.click('.modal-foot .btn-primary'); pg.wait_for_timeout(1000)
    check('renewal action updated', pg.locator('text=Renewal action: Submitted to authority').count() == 1)
    logout(pg)

    # Scoping as returned by the server
    login(pg, 'rajesh.menon@adroit.ae')
    d = pg.evaluate("fetch('/api/bootstrap').then(r=>r.json()).then(d=>[d.employees.length, d.employees.reduce((s,e)=>s+e.docs.length,0), d.employees.every(e=>e.department==='Trading Department'), d.assets.length, d.employees.every(e=>e.dob===null)])")
    check(f'department head sees own department only, no documents, no DOB {d}', d[0] > 0 and d[1] == 0 and d[2] and d[3] == 0 and d[4])
    logout(pg)
    login(pg, 'maria.santos@adroit.ae')
    t = pg.evaluate("fetch('/api/bootstrap').then(r=>r.json()).then(d=>[...new Set([...d.employees,...d.assets].flatMap(o=>o.docs.map(x=>x.type)))])")
    check(f'insurance officer sees insurance documents only {t}', set(t) == {'Health Insurance', 'Motor Insurance'})
    logout(pg)

    # Administrator: health, add user, cannot read HR content; new user forced to change password
    login(pg, 'kasun.bandara@adroit.ae'); go(pg, 'admin.health'); pg.wait_for_timeout(1000); pg.screenshot(path=OUT + 'health.png', full_page=True)
    check('system health page', pg.locator('h2:has-text("Background jobs")').count() == 1)
    go(pg, 'admin.users'); pg.fill('#nu-name', 'New Tester'); pg.fill('#nu-email', 'new.tester@adroit.ae'); pg.select_option('#nu-role', 'hr')
    pg.click('button:has-text("Add user")'); pg.wait_for_timeout(1200)
    temp = pg.locator('.temp-pw').inner_text() if pg.locator('.temp-pw').count() else ''
    check('temporary password shown once', len(temp) > 8)
    check('administrator blocked from HR content (403)', pg.evaluate("fetch('/api/employees').then(r=>r.status)") == 403)
    logout(pg)
    pg.fill('#login-email', 'new.tester@adroit.ae'); pg.fill('#login-pass', temp); pg.click('button[type=submit]'); pg.wait_for_timeout(1500)
    check('forced password change at first sign-in', pg.locator('text=Set your password').count() == 1)
    pg.fill('#cp-cur', temp); pg.fill('#cp-new', 'BetterPass2026'); pg.fill('#cp-again', 'BetterPass2026'); pg.click('button:has-text("Change password")')
    pg.wait_for_selector('.side', timeout=10000)
    check('new user signed in after changing password', pg.locator('.me-text:has-text("New Tester")').count() == 1)

    m = b.new_context(viewport={'width': 390, 'height': 844}, color_scheme='dark').new_page()
    m.goto(URL); m.fill('#login-email', 'gm@adroit.ae'); m.fill('#login-pass', 'Adroit@2026'); m.click('button[type=submit]'); m.wait_for_selector('.side'); m.wait_for_timeout(600)
    m.screenshot(path=OUT + 'mobile.png')
    check('no horizontal scroll on a phone', m.evaluate('document.documentElement.scrollWidth') <= 390)
    b.close()

print('\n'.join(results))
print('BROWSER ERRORS', errs[:8])
print(f"{sum(r.startswith('PASS') for r in results)}/{len(results)} passed")
