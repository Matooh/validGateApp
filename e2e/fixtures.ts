import { expect, test as base, type Locator, type Page } from '@playwright/test';

type EvidenceFixtures = {
  captureEvidence: (label: string, target?: Locator) => Promise<void>;
  visualEvidence: void;
};

async function screenshot(page: Page, target?: Locator) {
  const options = {
    type: 'jpeg' as const,
    quality: 80,
    animations: 'disabled' as const,
    caret: 'hide' as const,
    mask: [page.locator('input'), page.locator('textarea')],
    maskColor: '#dbeafe',
  };

  if (target) {
    await target.scrollIntoViewIfNeeded();
    return target.screenshot(options);
  }

  return page.screenshot({ ...options, fullPage: false });
}

/**
 * Captura una evidencia visual compacta al terminar cada caso. Los controles de
 * entrada se enmascaran para que passwords, codigos, payloads QR y PIN no
 * terminen en los reportes que se comparten fuera del equipo.
 */
export const test = base.extend<EvidenceFixtures>({
  captureEvidence: async ({ page }, use, testInfo) => {
    let sequence = 0;
    await use(async (label, target) => {
      sequence += 1;
      const image = await screenshot(page, target);
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
