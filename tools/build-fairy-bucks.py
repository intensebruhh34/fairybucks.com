"""Build Letter print sheets from the approved adult-fairy concept artwork.
Usage: python tools/build-fairy-bucks.py /absolute/path/to/approved-sheet.png
Only extracts the four existing bills; does not redraw or change their artwork.
"""
from pathlib import Path
import sys,io
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import letter
from pypdf import PdfReader
root=Path(__file__).resolve().parents[1]
source=Image.open(sys.argv[1]).convert('RGB')
assert source.size == (1024,1536), 'Use the approved source at its original resolution'
regions=[(17,21,1007,358),(17,407,1007,742),(17,792,1007,1126),(17,1176,1007,1511)]
notes={}
for value,box in zip([1,2,5,10],regions):
 buf=io.BytesIO();source.crop(box).save(buf,format='JPEG',quality=88,subsampling=2)
 notes[value]=buf.getvalue()
width=432; height=width*337/990
out=root/'printables';out.mkdir(exist_ok=True)
for key,values in [('1',[1]*4),('2',[2]*4),('5',[5]*4),('10',[10]*4),('mixed',[1,2,5,10])]:
 path=out/f'fairy-bucks-{key}.pdf'
 c=canvas.Canvas(str(path),pagesize=letter,pageCompression=1,invariant=1)
 c.setTitle('Fairy Bucks - '+('Mixed starter sheet' if key=='mixed' else key+'s'))
 c.setAuthor('Fairybucks')
 c.setFillColorRGB(.04,.23,.17);c.setFont('Helvetica-Bold',17)
 c.drawString(54,754,'Fairy Bucks | '+('Mixed starter sheet' if key=='mixed' else key+'s'))
 c.setFont('Helvetica',10);c.drawString(54,736,'Letter size. Print at 100% / Actual size. Cut along the outer dashed guides.')
 for index,value in enumerate(values):
  x=(612-width)/2;y=710-height-index*(height+13)
  c.drawImage(ImageReader(io.BytesIO(notes[value])),x,y,width,height)
  c.saveState();c.setStrokeColorRGB(.55,.55,.55);c.setLineWidth(.4);c.setDash(2,3)
  c.rect(x-3,y-3,width+6,height+6,stroke=1,fill=0);c.restoreState()
 c.setFont('Helvetica',8);c.setFillColorRGB(.3,.3,.3)
 c.drawString(54,47,'Printing does not change a vault balance. Record tooth rewards separately in Parent controls.')
 c.drawString(54,33,'Single-sided artwork. Print another copy whenever you need more. fairybucks.com')
 c.showPage();c.save()
 pdf=PdfReader(path);assert len(pdf.pages)==1
 assert tuple(float(v) for v in pdf.pages[0].mediabox)==(0,0,612,792)
 print(path.name,path.stat().st_size,'bytes')
