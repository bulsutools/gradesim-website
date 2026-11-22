import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

const backup = fs.readFileSync(new URL('../src/lib/fixtures/backup.json', import.meta.url));

async function open(page: Page, path = '/') {
	await page.goto(path);
	await page.locator('html[data-app-ready]').waitFor({ state: 'attached' });
}

// Most planner tests read the sheet, which a wide screen only shows when picked.
test.beforeEach(async ({ page }, info) => {
	if (!info.title.includes('@map')) await page.addInitScript(() => localStorage.setItem('gradesim:planView', 'sheet'));
});

// WebKit has no clipboard permission to grant, so the link tests read what the page copies.
async function copied(page: Page, button: string) {
	await page.evaluate(() => {
		navigator.clipboard.writeText = async (text) => void ((window as unknown as { copied: string }).copied = text);
	});
	await page.getByRole('button', { name: button }).click();
	await expect(page.getByText('The link is copied.')).toBeVisible();
	return page.evaluate(() => (window as unknown as { copied: string }).copied);
}

async function importFixture(page: Page) {
	await open(page);
	await page.getByTestId('file-input').first().setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
}

test('first visit leads with the extension and offers two other ways in', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Your GWA');
	await expect(page.getByText('Your grades stay in this browser.')).toBeVisible();
	await expect(page.locator('#main').getByRole('link', { name: 'Get the extension' })).toHaveAttribute('href', /install\/$/);
	await expect(page.getByRole('button', { name: 'Load backup' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'A plan for the sems you have left' })).toBeVisible();
	await page.getByRole('link', { name: 'Add my grades' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
	await expect(page.getByRole('button', { name: 'Enter grades by hand' })).toBeVisible();
});

test('unknown URLs get the branded 404', async ({ page }) => {
	const res = await page.goto('/does-not-exist/');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText("This page isn't here");
	await expect(page.getByRole('link', { name: 'Open GradeSim' })).toHaveAttribute('href', '/');
});


test('manual entry: add courses by hand and the GWA shows', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'Enter grades by hand' }).click();
	await page.getByLabel('Course code').fill('CMSC 12');
	await expect(page.getByLabel('Title')).toHaveValue('Foundations of Computer Science');
	await page.getByLabel('Grade', { exact: true }).selectOption('1.50');
	await page.getByRole('button', { name: 'Add course' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('1.5000');

	await page.getByRole('button', { name: 'Add or edit grades' }).click();
	await page.getByLabel('Course code').fill('MATH 27');
	await page.getByLabel('Grade', { exact: true }).selectOption('2.50');
	await page.getByRole('button', { name: 'Add course' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('2.0000');

	await open(page);
	await expect(page.getByTestId('gwa')).toHaveText('2.0000');
});

test('JSON import from the extension backup', async ({ page }) => {
	await importFixture(page);
	await expect(page.getByRole('status').first()).toContainText('Imported 15 courses');
	// 1.9773 is on no Latin honor track, and Honor Roll is not one.
	await expect(page.getByText(/Honor Roll|cum laude range/i)).toHaveCount(0);
	await expect(page.getByRole('region', { name: '1st sem AY 2023-24' })).toContainText('MATH 27');
	await page.getByRole('tab', { name: 'Target' }).click();
	await expect(page.getByText('Imported 15 courses')).toHaveCount(0);
});

test('Leave out sits in edit mode and a left-out course stays marked', async ({ page }) => {
	await importFixture(page);
	await expect(page.locator('.excl')).toHaveCount(0);
	await page.getByRole('button', { name: 'Add or edit grades' }).click();
	await page.locator('.excl').first().click();
	await page.getByRole('button', { name: 'Done editing' }).click();
	await expect(page.locator('.excl')).toHaveText(['Left out']);
	await expect(page.getByTestId('gwa')).toHaveText('2.0000');
});

test('a junk file is refused with a reason', async ({ page }) => {
	await open(page);
	await page.getByTestId('file-input').first().setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
	await expect(page.getByRole('status').first()).toContainText("isn't a GradeSim backup");
});





test('theme toggle cycles and persists', async ({ page }) => {
	await open(page);
	const html = page.locator('html');
	const toggle = page.getByRole('button', { name: /theme/i });
	await toggle.click();
	await expect(html).toHaveAttribute('data-theme', 'light');
	await toggle.click();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await open(page);
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await page.getByRole('button', { name: /theme/i }).click();
	await expect(html).not.toHaveAttribute('data-theme');
});





test('content pages and old trailing-slash URLs', async ({ page, request }) => {
	for (const path of ['/about/', '/install/', '/privacy/', '/terms/']) {
		const res = await page.goto(path);
		expect(res?.status()).toBe(200);
		await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://gradesim.bulsu.tools${path}`);
	}
	const res = await request.get('/privacy', { maxRedirects: 0 });
	expect([301, 308]).toContain(res.status());
});


test('imports from the extension through the window bridge', async ({ page }) => {
	// Stand-in for the Firefox content script: answers the page's requests.
	await page.addInitScript((payload) => {
		window.addEventListener('message', (e) => {
			const type = e.data?.type;
			if (e.source !== window || (type !== 'GRADESIM_PING' && type !== 'GRADESIM_GET_GRADES')) return;
			const reply = type === 'GRADESIM_PING' ? { hasGrades: true } : JSON.parse(payload);
			window.postMessage({ type: 'GRADESIM_REPLY', request: type, payload: reply }, location.origin);
		});
	}, backup.toString());
	await open(page);
	await page.getByRole('button', { name: 'Import from the extension' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await expect(page.getByRole('status').first()).toContainText('from the extension');
});

test('a visit from the extension popup imports the grades and opens the planner', async ({ page }) => {
	await page.addInitScript((payload) => {
		window.addEventListener('message', (e) => {
			const type = e.data?.type;
			if (e.source !== window || (type !== 'GRADESIM_PING' && type !== 'GRADESIM_GET_GRADES')) return;
			const reply = type === 'GRADESIM_PING' ? { hasGrades: true, fetchedAt: 1 } : JSON.parse(payload);
			window.postMessage({ type: 'GRADESIM_REPLY', request: type, payload: reply }, location.origin);
		});
	}, backup.toString());
	await open(page, '/?from=extension&whatif=MATH%2027#planner');
	await expect(page.getByRole('status').first()).toContainText('from the extension');
	await expect(page.getByRole('tab', { name: 'Planner' })).toHaveAttribute('aria-selected', 'true');
		expect(new URL(page.url()).search).toBe('');
});

test('newer grades from the extension load on the next visit', async ({ page }) => {
	// The stand-in reads ALAB SMS again once localStorage says so, and CMSC 12 comes back as 1.00.
	await page.addInitScript((payload) => {
		window.addEventListener('message', (e) => {
			const type = e.data?.type;
			if (e.source !== window || (type !== 'GRADESIM_PING' && type !== 'GRADESIM_GET_GRADES')) return;
			const fetchedAt = Number(localStorage.getItem('mockFetchedAt') ?? 1);
			const data = { ...JSON.parse(payload), fetchedAt };
			if (fetchedAt > 1) (Object.values(data.gradesData.student_grades)[0] as { values: { grade: string }[] }).values[0].grade = '1.00';
			const reply = type === 'GRADESIM_PING' ? { hasGrades: true, fetchedAt } : data;
			window.postMessage({ type: 'GRADESIM_REPLY', request: type, payload: reply }, location.origin);
		});
	}, backup.toString());
	await open(page);
	await page.getByRole('button', { name: 'Import from the extension' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await page.reload();
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await page.evaluate(() => localStorage.setItem('mockFetchedAt', '2'));
	await page.reload();
	await expect(page.getByRole('status').first()).toContainText('newer grades from the extension');
	await expect(page.getByTestId('gwa')).not.toHaveText('1.9773');
});

test('the phone bookmark opens GradeSim with the ALAB SMS grades in the link', async ({ page }) => {
	const { BOOKMARKLET } = await import('../src/lib/bookmarklet.ts');
	const amis = JSON.parse(backup.toString()).gradesData;
	await page.route('https://alabsms.bulsu.edu.ph/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>ALAB SMS</p>' }));
	const cors = {
		'access-control-allow-origin': 'https://alabsms.bulsu.edu.ph',
		'access-control-allow-credentials': 'true',
		'access-control-allow-headers': 'authorization,x-session-id'
	};
	await page.route('https://alabsms-server.bulsu.edu.ph/**', (r) =>
		r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ json: amis, headers: cors })
	);
	await page.goto('https://alabsms.bulsu.edu.ph/');
	await page.evaluate(() => localStorage.setItem('auth._token.local', 'Bearer test'));
	page.once('dialog', (d) => d.dismiss());
	await page.route('https://gradesim.bulsu.tools/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>GradeSim</p>' }));
	await Promise.all([page.waitForURL(/gradesim\.bulsu\.tools\/#d=/), page.evaluate(decodeURIComponent(BOOKMARKLET.slice('javascript:'.length)))]);
	await open(page, '/' + new URL(page.url()).hash);
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await expect(page.getByRole('status').first()).toContainText('from your link');
	expect(page.url()).toMatch(/#grades$/);
});

test('a copied link opens the grades in another browser, and asks before it replaces any', async ({ page, browser }) => {
	await importFixture(page);
	await page.getByText('Back up or clear your data').click();
	const link = await copied(page, 'Copy a link to my grades');

	const other = await (await browser.newContext()).newPage();
	await other.goto(link);
	await expect(other.getByTestId('gwa')).toHaveText('1.9773');
	await other.context().close();

	let asked = '';
	page.once('dialog', (d) => {
		asked = d.message();
		d.dismiss();
	});
	await page.goto(link);
	await expect.poll(() => asked).toContain('Replace the grades');
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
});


test('@phone the welcome screen leads with the ALAB SMS bookmark', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('#main').getByRole('link', { name: 'Get my grades from ALAB SMS' })).toHaveAttribute('href', /install\/#phone$/);
	await expect(page.locator('#main').getByRole('link', { name: 'Get the extension' })).toBeHidden();
});

test('every Wrapped card is drawn on the picnic art, this sem comes first with its GWA, and the overall GWA shows only when asked', async ({ page }) => {
	await importFixture(page);
	await page.getByRole('tab', { name: 'Wrapped' }).click();
	const card = page.getByRole('img', { name: /drawn on a picnic blanket/ });
	await expect(card).toHaveAccessibleName(/^Solid sem, GWA 1\.8750, 12 units, drawn/);
	await page.getByLabel('GWA on the card').selectOption({ label: '1.8x' });
	await expect(card).toHaveAccessibleName(/GWA 1\.8x,/);
	await page.getByLabel('GWA on the card').selectOption({ label: '1.8750' });
	await expect(card).toHaveAccessibleName(/GWA 1\.8750/);
	await page.getByRole('combobox', { name: /^Sem/ }).selectOption({ index: 0 });
	await expect(card).not.toHaveAccessibleName(/1\.8750/);
	await page.getByRole('combobox', { name: /^Sem/ }).selectOption({ index: 2 });
	await page.getByRole('button', { name: 'Next' }).click();
	await expect(card).toHaveAccessibleName(/^Honor roll, drawn/);
	await page.getByLabel('GWA on the card').selectOption({ label: '1.9773' });
	await expect(card).toHaveAccessibleName(/^Honor roll, GWA 1\.9773/);
	const blank = await card.getAttribute('src');
	await page.getByRole('textbox', { name: 'Your name on the card' }).fill('Iska');
	await expect(card).not.toHaveAttribute('src', blank!);
	for (const name of [/Sem stats, Best sem/, /Your highlights/, /Variety pack/, /Just starting/]) {
		await page.getByRole('button', { name: 'Next' }).click();
		await expect(card).toHaveAccessibleName(name);
	}
});



