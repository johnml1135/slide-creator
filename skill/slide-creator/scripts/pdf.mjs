import { readFile, writeFile } from 'node:fs/promises';
import { importDep } from './lib/project.mjs';

export async function finishPdf(file, title, author, titles) {
  const { PDFDocument, PDFName, PDFHexString } = await importDep('pdf-lib');
  const pdf = await PDFDocument.load(await readFile(file));
  pdf.setTitle(String(title));
  if (author) pdf.setAuthor(String(author));
  const pages = pdf.getPages();
  const entries = titles.map((name, i) => ({ name, page: pages[i] })).filter((x) => x.name && x.page);
  if (entries.length) {
    const ctx = pdf.context;
    const root = ctx.obj({ Type: 'Outlines', Count: entries.length });
    const rootRef = ctx.register(root);
    const refs = entries.map(() => ctx.nextRef());
    entries.forEach(({ name, page }, i) => {
      const item = ctx.obj({ Title: PDFHexString.fromText(name), Parent: rootRef, Dest: ctx.obj([page.ref, PDFName.of('Fit')]) });
      if (i) item.set(PDFName.of('Prev'), refs[i - 1]);
      if (i + 1 < refs.length) item.set(PDFName.of('Next'), refs[i + 1]);
      ctx.assign(refs[i], item);
    });
    root.set(PDFName.of('First'), refs[0]);
    root.set(PDFName.of('Last'), refs.at(-1));
    pdf.catalog.set(PDFName.of('Outlines'), rootRef);
    pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
  }
  await writeFile(file, await pdf.save());
}
