import { expect, test as base, type Locator, type Page } from '@playwright/test';

type EvidenceFixtures = {
  captureEvidence: (
    label: string,
    target?: Locator,
    options?: { preserveToast?: boolean },
  ) => Promise<void>;
  visualEvidence: void;
};

async function dismissFeedbackToast(page: Page) {
  const closeButton = page.locator('button[aria-label^="Cerrar notific"]');
  if (!(await closeButton.first().isVisible().catch(() => false))) return;

  await closeButton.first().click();
  await closeButton.first().waitFor({ state: 'hidden' }).catch(() => undefined);
}

async function screenshot(
  page: Page,
  target?: Locator,
  evidenceOptions: { preserveToast?: boolean } = {},
) {
  if (!evidenceOptions.preserveToast) await dismissFeedbackToast(page);

  const sensitiveFields = page.locator([
    'input[type="password"]',
    'textarea',
    'input[name*="code" i]',
    'input[id*="code" i]',
    'input[name*="pin" i]',
    'input[id*="pin" i]',
    'input[name*="payload" i]',
    'input[id*="payload" i]',
  ].join(', '));
  const screenshotOptions = {
    type: 'jpeg' as const,
    quality: 80,
    animations: 'disabled' as const,
    caret: 'hide' as const,
    // Los PIN generados se renderizan como texto, no como inputs. Tambien se
    // enmascaran para que la trazabilidad visual no exponga credenciales.
    mask: [sensitiveFields, page.getByText(/^\d{5}$/)],
    maskColor: '#dbeafe',
    style: target ? 'header.sticky { visibility: hidden !important; }' : undefined,
  };

  if (target) {
    await target.waitFor({ state: 'visible', timeout: 10_000 });
    await target.scrollIntoViewIfNeeded();
    return target.screenshot(screenshotOptions);
  }

  return page.screenshot({ ...screenshotOptions, fullPage: false });
}

/**
 * Captura una evidencia visual compacta al terminar cada caso. Los controles de
 * sensibles se enmascaran para que passwords, codigos, payloads QR y PIN no
 * terminen en los reportes que se comparten fuera del equipo.
 */
export const test = base.extend<EvidenceFixtures>({
  captureEvidence: async ({ page }, use, testInfo) => {
    let sequence = 0;
    await use(async (label, target, options) => {
      sequence += 1;
      const image = await screenshot(page, target, options);
      await testInfo.attach(`evidencia-visual-${String(sequence).padStart(2, '0')} — ${label}`, {
        body: image,
        contentType: 'image/jpeg',
      });
    });
  },
  visualEvidence: [async ({ page }, use, testInfo) => {
    await use();

    if (page.isClosed()) return;
    if (testInfo.attachments.some((attachment) => attachment.name.startsWith('evidencia-visual-'))) return;

    try {
      const image = await screenshot(page);

      await testInfo.attach('evidencia-visual-01 — Estado final', {
        body: image,
        contentType: 'image/jpeg',
      });
    } catch (error) {
      // La evidencia complementa el resultado funcional y nunca debe convertir
      // por si sola una prueba aprobada en fallida.
      console.warn(`No se pudo capturar evidencia visual para "${testInfo.title}".`, error);
    }
  }, { auto: true }],
});

export { expect };
