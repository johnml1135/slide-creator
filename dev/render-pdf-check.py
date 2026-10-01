"""Optional maintainer check: render selected exported PDF pages with the style-import dependency."""
import sys
from pathlib import Path
import pypdfium2 as pdfium
pdf_path = Path(sys.argv[1])
doc = pdfium.PdfDocument(str(pdf_path))
for value in sys.argv[2:] or ['1']:
    index = int(value) - 1
    page = doc[index]
    bitmap = page.render(scale=96 / 72)
    bitmap.to_pil().save(pdf_path.parent / f'pdf-page-{index + 1:02}.png')
    bitmap.close()
    page.close()
print(f'Rendered exported PDF: {len(doc)} pages')
doc.close()
