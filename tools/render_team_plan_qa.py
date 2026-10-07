"""Rasterize the Word-exported PDF for document layout verification."""
import sys
from pathlib import Path
import pypdfium2 as pdfium

pdf = pdfium.PdfDocument(sys.argv[1])
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
for index, page in enumerate(pdf):
    image = page.render(scale=1.8).to_pil()
    image.save(out / f'page-{index + 1}.png')
    print(f'page-{index+1}: {image.width}x{image.height}')
print(f'total: {len(pdf)} pages')
