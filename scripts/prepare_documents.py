from pathlib import Path
import json,os,re,zipfile,xml.etree.ElementTree as ET
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/prepared';NASA=Path(os.environ.get('NASA_DATA_DIR',str(Path.home()/'Documents/hackathon/NASA')))
c=json.loads((OUT/'catalog.json').read_text());c['documents']=[d for d in c['documents'] if d['id'].startswith('DOC:audit:')]
for name,dst,ds in [('FLEX-1261_Summary_prelim.pdf','flex-1261.pdf','FLEX'),('SLICE IP-D crew training 2011.pdf','slice-training.pdf','context'),('ASGSR BASS SIBAL talk Final.pdf','bass-sibal.pdf','context'),('ISS Denver 2013-BASS.pdf','bass-denver.pdf','context')]:
 p=NASA/name
 if not p.exists():continue
 for i,page in enumerate(PdfReader(p).pages,1):
  txt=re.sub(r'\s+',' ',page.extract_text() or '').strip()
  if txt:c['documents'].append({'id':f'DOC:{dst}:{i}','title':f'{name} · PDF page {i}','text':txt[:2500],'source_url':f'references/{dst}#page={i}','dataset':ds,'limitations':['Document excerpts are context, not new experimental rows. BASS/SLICE cases must not be merged into FLEX or BASS-II tables. Extracted text can omit figure details; inspect the source page.']})
p=NASA/'BASS Overview.pptx'
if p.exists():
 with zipfile.ZipFile(p) as z:
  for name in sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+.xml$',n)],key=lambda n:int(re.search(r'slide(\d+)',n)[1])):
   i=int(re.search(r'slide(\d+)',name)[1]);txt=' '.join(ET.fromstring(z.read(name)).itertext())
   c['documents'].append({'id':f'DOC:bass-overview:{i}','title':f'BASS Overview · slide {i}','text':txt[:2500],'source_url':'references/bass-overview.pptx','dataset':'context','limitations':['BASS overview diagrams are not calibrated FLEX flame geometry.']})
for s in c['series']:c['dictionary'][s['id']]={ch['key']:{k:ch[k] for k in ['label','unit','kind','source_column']} for ch in s['channels']}
(OUT/'catalog.json').write_text(json.dumps(c,separators=(',',':')));(OUT/'variable_dictionary.json').write_text(json.dumps(c['dictionary'],indent=2));print('Indexed',len(c['documents']),'document pages/audit sections; dictionaries include all canonical sensor streams.')
