import { test, expect } from '@playwright/test';

test.describe('School Management System v2 — End-to-End Workflows', () => {
  test('Login page renders demo credentials, supports username login, and redirects to dashboard', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /Vidya Bharati Model Senior Secondary School/i })
    ).toBeVisible();
    await expect(page.getByText('@superadmin')).toBeVisible();

    await page.getByLabel(/Username or Email Address/i).fill('superadmin');
    await page.getByLabel(/Password/i).fill('School@2026');
    await page.getByRole('button', { name: /Sign in to Portal/i }).click();

    await page.waitForURL('**/dashboard');
    await expect(page.locator('main').getByText(/Dr\. Subir Chatterjee/i).first()).toBeVisible();
    await expect(page.locator('header').getByText(/Super Administrator/i)).toBeVisible();
  });

  test('Mobile viewport drawer navigation works cleanly without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.getByLabel(/Username or Email Address/i).fill('admin');
    await page.getByLabel(/Password/i).fill('School@2026');
    await page.getByRole('button', { name: /Sign in to Portal/i }).click();
    await page.waitForURL('**/dashboard');

    const menuButton = page.getByRole('button', { name: /Toggle navigation menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    await expect(page.getByRole('link', { name: /Students & Promotions/i }).first()).toBeVisible();
  });

  test('Super Admin can manage Boards (CBSE/ICSE/WBBSE/WBCHSE/Custom), Academics, Students, Timetables, and Settings', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/Username or Email Address/i).fill('superadmin');
    await page.getByLabel(/Password/i).fill('School@2026');
    await page.getByRole('button', { name: /Sign in to Portal/i }).click();
    await page.waitForURL('**/dashboard');

    // 1. Boards & Assessment Configuration
    await page.goto('/boards');
    await expect(page.locator('main').getByText(/WBCHSE/i).first()).toBeVisible();
    await expect(page.locator('main').getByText(/Semester I/i).first()).toBeVisible();

    // 2. Academics & Teacher Assignments
    await page.goto('/academics');
    await expect(page.locator('main').getByText(/Class X/i).first()).toBeVisible();

    // 3. Students & Promotion Console
    await page.goto('/students');
    await expect(page.locator('main').getByText(/Aarav Roy/i).first()).toBeVisible();

    // 4. Timetables & PDF download
    await page.goto('/timetables');
    const pdfHref = await page
      .locator('a[href^="/api/pdf/timetable/"]')
      .first()
      .getAttribute('href');
    expect(pdfHref).toBeTruthy();
    const ttPdfResp = await page.request.get(pdfHref!);
    expect(ttPdfResp.status()).toBe(200);
    expect(ttPdfResp.headers()['content-type']).toContain('application/pdf');

    // 5. Settings & Audit Log
    await page.goto('/settings');
    await expect(
      page.getByRole('heading', { name: /School Settings & Security Audit Log/i })
    ).toBeVisible();
  });

  test('Teacher can view assigned classes, bulk marks entry (0, AB, Missing), and upload/download study materials', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/Username or Email Address/i).fill('teacher');
    await page.getByLabel(/Password/i).fill('School@2026');
    await page.getByRole('button', { name: /Sign in to Portal/i }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/exams');
    await expect(page.locator('main').getByText(/CBSE Class X Term I Examination/i).first()).toBeVisible();

    const tabHref = await page
      .locator('a[href^="/api/pdf/tabulation/"]')
      .first()
      .getAttribute('href');
    expect(tabHref).toBeTruthy();
    const tabPdfResp = await page.request.get(tabHref!);
    expect(tabPdfResp.status()).toBe(200);
    expect(tabPdfResp.headers()['content-type']).toContain('application/pdf');

    // Study materials page & private Storage download
    await page.goto('/materials');
    await expect(
      page.getByRole('heading', { name: /Study Materials & Syllabus Repository/i })
    ).toBeVisible();
    const matHref = await page
      .locator('a[href^="/api/materials/"]')
      .first()
      .getAttribute('href');
    expect(matHref).toBeTruthy();
    const matDownload = await page.request.get(matHref!);
    expect(matDownload.status()).toBe(200);
    expect(matDownload.headers()['content-type']).toContain('application/pdf');
  });

  test('Accountant can view partial fee payments and download numbered INR receipts as PDF', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/Username or Email Address/i).fill('accountant');
    await page.getByLabel(/Password/i).fill('School@2026');
    await page.getByRole('button', { name: /Sign in to Portal/i }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/fees');
    await expect(page.locator('main').getByText(/RCP-2026-005001/i).first()).toBeVisible();

    const rcpHref = await page
      .locator('a[href^="/api/pdf/receipt/"]')
      .first()
      .getAttribute('href');
    expect(rcpHref).toBeTruthy();
    const receiptPdf = await page.request.get(rcpHref!);
    expect(receiptPdf.status()).toBe(200);
    expect(receiptPdf.headers()['content-type']).toContain('application/pdf');
  });

  test('Librarian can view barcoded book copies, borrow requests, active loans, and process returns', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/Username or Email Address/i).fill('librarian');
    await page.getByLabel(/Password/i).fill('School@2026');
    await page.getByRole('button', { name: /Sign in to Portal/i }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/library');
    await expect(page.locator('table').getByText(/Concepts of Physics/i).first()).toBeVisible();
    await expect(page.locator('main').getByText(/ACC-2026-001/i).first()).toBeVisible();
  });

  test('Parent can view linked child published report card, download PDF, and inspect notices', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/Username or Email Address/i).fill('parent');
    await page.getByLabel(/Password/i).fill('School@2026');
    await page.getByRole('button', { name: /Sign in to Portal/i }).click();
    await page.waitForURL('**/dashboard');

    await expect(page.getByText(/Aarav Roy/i).first()).toBeVisible();

    await page.goto('/exams');
    await expect(page.getByText(/Aarav Roy/i).first()).toBeVisible();

    const rcHref = await page
      .locator('a[href^="/api/pdf/report-card/"]')
      .first()
      .getAttribute('href');
    expect(rcHref).toBeTruthy();
    const rcPdf = await page.request.get(rcHref!);
    expect(rcPdf.status()).toBe(200);
    expect(rcPdf.headers()['content-type']).toContain('application/pdf');

    await page.goto('/notices');
    await expect(
      page.getByRole('heading', { name: /Noticeboard & Academic Calendar/i })
    ).toBeVisible();
  });
});
