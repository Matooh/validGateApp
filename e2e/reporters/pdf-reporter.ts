import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { TRACEABILITY, scenarioId } from '../support/traceability';

type Row = {
  id: string;
  title: string;
  project: string;
  status: string;
  duration: number;
  error: string;
  evidence: Array<{ label: string; data: string }>;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!);
}

function statusLabel(status: string) {
  return ({ passed: 'Aprobada', failed: 'Fallida', skipped: 'Omitida', timedOut: 'Tiempo agotado', interrupted: 'Interrumpida' } as Record<string, string>)[status] ?? status;
}

export default class ValidGatePdfReporter implements Reporter {
  private rows: Row[] = [];
  private startedAt = new Date();
  private config?: FullConfig;

  onBegin(config: FullConfig) {
    this.config = config;
    this.startedAt = new Date();
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    const attachments = result.attachments.filter((item) =>
      item.name.startsWith('evidencia-visual-') && item.contentType.startsWith('image/'),
    );
    const evidence: Row['evidence'] = [];

    for (const attachment of attachments) {
      let body = attachment.body;
      if (!body && attachment.path) {
        try {
          body = await fs.readFile(attachment.path);
        } catch {
          // El resultado funcional sigue siendo valido si una evidencia no pudo leerse.
        }
      }
      if (body) {
        evidence.push({
          label: attachment.name.replace(/^evidencia-visual-\d+\s*—\s*/, ''),
          data: `data:${attachment.contentType};base64,${body.toString('base64')}`,
        });
      }
    }

    this.rows.push({
      id: scenarioId(test.title),
      title: test.title,
      project: test.parent.project()?.name ?? 'chromium',
      status: result.status,
      duration: result.duration,
      error: result.error?.message ?? '',
      evidence,
    });
  }

  async onEnd(result: FullResult) {
    const outputDir = path.resolve(process.cwd(), process.env.E2E_REPORT_DIR ?? 'reports');
    await fs.mkdir(outputDir, { recursive: true });
    const totals = {
      passed: this.rows.filter((row) => row.status === 'passed').length,
      failed: this.rows.filter((row) => ['failed', 'timedOut', 'interrupted'].includes(row.status)).length,
      skipped: this.rows.filter((row) => row.status === 'skipped').length,
    };
    const elapsed = Date.now() - this.startedAt.getTime();
    const tableRows = this.rows.map((row) => {
      const trace = TRACEABILITY[row.id] ?? { requirement: '—', objectives: '—', role: '—' };
      return `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.title.replace(/^.*?—\s*/, ''))}</td><td>${trace.requirement}</td><td>${trace.objectives}</td><td>${escapeHtml(trace.role)}</td><td class="${row.status}">${statusLabel(row.status)}</td><td>${(row.duration / 1000).toFixed(1)} s</td></tr>`;
    }).join('');
    const failures = this.rows.filter((row) => row.error).map((row) => `<section class="failure"><h3>${escapeHtml(row.id)} — ${escapeHtml(row.title)}</h3><pre>${escapeHtml(row.error)}</pre></section>`).join('');
    let evidenceIndex = 0;
    const evidenceGallery = this.rows.flatMap((row) => row.evidence.map((evidence) => {
      evidenceIndex += 1;
      const trace = TRACEABILITY[row.id] ?? { requirement: '—', objectives: '—', role: '—' };
      return `<figure class="evidence"><div class="evidence-heading"><div><span class="sequence">Evidencia ${evidenceIndex} · ${escapeHtml(evidence.label)}</span><h3>${escapeHtml(row.id)} — ${escapeHtml(row.title.replace(/^.*?—\s*/, ''))}</h3></div><span class="status ${row.status}">${statusLabel(row.status)}</span></div><img src="${evidence.data}" alt="${escapeHtml(evidence.label)} de ${escapeHtml(row.id)}"><figcaption>Etapa: ${escapeHtml(evidence.label)} · RF: ${escapeHtml(trace.requirement)} · OE: ${escapeHtml(trace.objectives)} · Rol: ${escapeHtml(trace.role)}.</figcaption></figure>`;
    })).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>VALIDGATE — Resultados E2E</title><style>
      @page { size: A4 landscape; margin: 14mm; } body { font: 12px Arial, sans-serif; color: #0f172a; } h1 { color:#075985; margin-bottom:4px; } h2 { margin-top:24px; } .meta { color:#475569; } .cards { display:flex; gap:12px; margin:18px 0; } .card { flex:1; padding:12px; border:1px solid #cbd5e1; border-radius:8px; } .value { font-size:24px; font-weight:700; } table { width:100%; border-collapse:collapse; font-size:10px; } th,td { border:1px solid #cbd5e1; padding:6px; vertical-align:top; } th { background:#e0f2fe; } .passed { color:#047857; font-weight:700; } .failed,.timedOut,.interrupted { color:#be123c; font-weight:700; } .skipped { color:#a16207; font-weight:700; } .failure { page-break-inside:avoid; border-left:4px solid #e11d48; padding-left:10px; } pre { white-space:pre-wrap; font-size:9px; background:#fff1f2; padding:8px; } .evidence-intro { page-break-before:always; color:#475569; } .evidence { page-break-inside:avoid; page-break-before:always; margin:0; } .evidence:first-of-type { page-break-before:auto; } .evidence-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:8px; } .evidence h3 { margin:3px 0 0; color:#0f172a; font-size:16px; } .sequence { color:#0284c7; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; } .status { border:1px solid currentColor; border-radius:999px; padding:5px 9px; } .evidence img { display:block; width:100%; max-height:154mm; object-fit:contain; object-position:top center; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc; } figcaption { margin-top:7px; color:#475569; font-size:10px; } footer { margin-top:20px; color:#64748b; }
    </style></head><body><h1>VALIDGATE — Reporte de pruebas funcionales E2E</h1>
    <p class="meta">Fecha: ${this.startedAt.toLocaleString('es-CL')} · Entorno: ${escapeHtml(process.env.E2E_ENVIRONMENT_NAME ?? 'Supabase testing')} · Build: ${escapeHtml(process.env.E2E_BUILD_ID ?? 'ejecucion-local')} · Navegador: Chromium · Resultado global: ${escapeHtml(result.status)}</p>
    <div class="cards"><div class="card"><div>Total</div><div class="value">${this.rows.length}</div></div><div class="card"><div>Aprobadas</div><div class="value">${totals.passed}</div></div><div class="card"><div>Fallidas</div><div class="value">${totals.failed}</div></div><div class="card"><div>Omitidas</div><div class="value">${totals.skipped}</div></div><div class="card"><div>Duración</div><div class="value">${(elapsed / 1000).toFixed(1)} s</div></div></div>
    <h2>Matriz de resultados</h2><table><thead><tr><th>ID</th><th>Escenario</th><th>RF</th><th>OE</th><th>Rol</th><th>Resultado</th><th>Duración</th></tr></thead><tbody>${tableRows}</tbody></table>
    ${failures ? `<h2>Detalle de fallos</h2>${failures}` : '<h2>Conclusión</h2><p>No se registraron fallos en esta ejecución.</p>'}
    ${evidenceGallery ? `<h2 class="evidence-intro">Anexo de evidencias visuales</h2><p class="meta">Las imágenes documentan las etapas relevantes de cada caso. Los campos de entrada se enmascaran para proteger contraseñas, códigos, PIN y payloads de prueba.</p>${evidenceGallery}` : '<h2>Evidencias visuales</h2><p>No fue posible obtener capturas en esta ejecución.</p>'}
    <footer>El reporte HTML interactivo y los artefactos técnicos de fallos se conservan junto con este archivo.</footer></body></html>`;
    const htmlPath = path.join(outputDir, 'VALIDGATE_resultados_e2e.html');
    await fs.writeFile(htmlPath, html, 'utf8');

    try {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.pdf({
        path: path.join(outputDir, 'VALIDGATE_resultados_e2e.pdf'),
        format: 'A4',
        landscape: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#64748b">VALIDGATE · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
        margin: { top: '14mm', right: '14mm', bottom: '18mm', left: '14mm' },
      });
      await browser.close();
    } catch (error) {
      console.warn('No se pudo generar el PDF; el resumen HTML sí quedó disponible.', error);
    }
  }
}
