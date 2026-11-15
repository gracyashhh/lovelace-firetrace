"""Read-only NASA adapters. Run once; never executed by chat requests."""
from pathlib import Path
import os,json,re,hashlib,gzip,datetime
import pandas as pd
import numpy as np
import openpyxl
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/prepared';OUT.mkdir(parents=True,exist_ok=True)
NASA=Path(os.environ.get('NASA_DATA_DIR',str(Path.home()/'Documents/hackathon/NASA')));DL=Path(os.environ.get('NASA_DOWNLOADS_DIR',str(Path.home()/'Downloads')))
URL={k:'https://psi.nasa.gov/physci/repo/data/investigations/'+v for k,v in {'FLEX':'PSI-69','BASS-II':'PSI-25','SAME-R':'PSI-101','SAFFIRE':'PSI-98'}.items()}
records=[];series=[];manifest=[];dictionary={};documents=[]
def clean(v):
 if v is None or (not isinstance(v,str) and pd.isna(v)):return None
 if isinstance(v,(datetime.datetime,datetime.date)):return v.isoformat()
 if isinstance(v,np.generic):return v.item()
 return v.strip() if isinstance(v,str) else v
def number(v):
 v=clean(v)
 if v is None or str(v).lower() in ['', 'n/a','na','none','–','—','-']:return None,'missing'
 approx=str(v).startswith('~');s=str(v).lstrip('~').strip()
 try:
  x=float(s)
  if not np.isfinite(x):return None,'invalid'
  return x,'approximate' if approx else None
 except (TypeError,ValueError):return None,'malformed_or_excel_error'
def csv(path):
 for encoding in ['utf-8-sig','cp1252']:
  try:return pd.read_csv(path,encoding=encoding,dtype=str,keep_default_na=False),encoding
  except UnicodeDecodeError:pass
 raise ValueError('Unsupported encoding')
def source(path,sheet,row):return {'file':path.name,'sheet':sheet,'row':row}
def register(path,dataset,**extra):
 manifest.append({'dataset':dataset,'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source_url':URL[dataset],**extra})
def add_rows(path,dataset,frame,mapping,idcol,sheet='CSV',firstrow=2):
 dictionary.setdefault(dataset,{})
 for key,(idx,unit,kind) in mapping.items():dictionary[dataset][key]={'label':str(frame.columns[idx]),'unit':unit,'kind':kind,'source_column':idx+1}
 kept=[];skip=[]
 for i,r in frame.iterrows():
  if clean(r.iloc[idcol]) in [None,''] or str(r.iloc[idcol])==str(frame.columns[idcol]):skip.append(firstrow+i);continue
  vals={};flags={}
  for key,(idx,unit,kind) in mapping.items():
   v=clean(r.iloc[idx])
   if kind=='category':vals[key]=v
   else:
    vals[key],flag=number(v)
    if flag:flags[key]=flag
    if vals[key] is not None and (key in ['pressure','diameter'] and vals[key]<=0 or key in ['oxygen','oxygen_final'] and (vals[key]<0 or vals[key]>(1 if dataset=='FLEX' else 100)) or key in ['particles','dust','mass_loss'] and vals[key]<0):flags[key]='suspicious_preserved'
  ident=str(clean(r.iloc[idcol]));rec={'id':dataset+':'+ident+':r'+str(firstrow+i),'experiment_id':ident,'dataset':dataset,'source':source(path,sheet,firstrow+i),'source_url':URL[dataset],'values':vals,'flags':flags,'raw':{str(j+1):clean(v) for j,v in enumerate(r)}}
  records.append(rec);kept.append(rec)
 return kept,skip
flex=DL/'PSI-69_Experimental table_FLEX.csv'
if not flex.exists():flex=NASA/flex.name
if flex.exists():
 d,enc=csv(flex);keys=['test','identifier','date','gmt','fuel','pressure','oxygen','nitrogen','co2','helium','diameter','extinction_diameter','burning_rate','burn_time','test_end'];units=['','','','','','mmHg','mole fraction','mole fraction','mole fraction','mole fraction','mm','mm','mm²/s','s',''];mapping={k:(i,units[i],'category' if i in [0,1,2,3,4,14] else 'condition' if i<11 else 'measurement') for i,k in enumerate(keys)};rr,sk=add_rows(flex,'FLEX',d,mapping,0);register(flex,'FLEX',record_count=len(rr),encoding=enc,excluded_rows=sk,limitations=['Burning rate header corrected from mm to mm²/s using NASA/TP-2015-216046 Table IX; no rescaling.','Extinction diameter is droplet diameter at visible extinction. Missing outcomes remain null.','Rows are independent tests, not a time series; repeated identifiers remain traceable.'])
bass=NASA/'PSI-25_Experimental table_BASS-II.csv'
if bass.exists():
 d,enc=csv(bass);mapping={'test':(1,'','category'),'sample':(4,'','category'),'material':(5,'','category'),'flow_restrictor':(6,'setting','condition'),'fan_display':(7,'display setting; not calibrated velocity','condition'),'air_display':(8,'display setting; not calibrated velocity','condition'),'oxygen':(11,'% by volume','condition'),'oxygen_final':(12,'% by volume','measurement'),'co2':(13,'% by volume','condition'),'co2_final':(14,'% by volume','measurement'),'co':(15,'ppm','condition'),'co_final':(16,'ppm','measurement')};rr,sk=add_rows(bass,'BASS-II',d,mapping,1);register(bass,'BASS-II',record_count=len(rr),encoding=enc,excluded_rows=sk,limitations=['Fan/air displays are settings, not calibrated cm/s. No flame spread rate or extinction outcome column.','Material descriptions retained verbatim; no inferred equivalence between thicknesses or geometries.','Negative gas values and unusual final oxygen values preserved; require sensor/QC review.'])
same=DL/'Combined SAMER Results 06 02 14.xlsx'
if same.exists():
 d=pd.read_excel(same,sheet_name='SAME R Results',header=1,dtype=object,keep_default_na=False)
 mapping={'material':(1,'','category'),'sample':(2,'','category'),'test':(3,'','category'),'same_number':(5,'','category'),'description':(6,'','category'),'velocity':(10,'cm/sec','condition'),'duration':(12,'sec','condition'),'aging':(17,'not explicit in this column','derived'),'obscuration':(42,'volts','measurement'),'scatter':(43,'volts','measurement'),'particles':(50,'PT/cc','measurement'),'dust':(53,'mg/m3','measurement'),'number_concentration':(55,'#/cm3','derived'),'mean_diameter':(60,'micro-m','derived'),'mass_diameter':(61,'micro-m','derived'),'temperature':(77,'C; Eq. 2 of lrt','derived'),'mass_loss':(78,'mg','measurement')}
 rr,sk=add_rows(same,'SAME-R',d,mapping,3,'SAME R Results',3);register(same,'SAME-R',record_count=len(rr),sheet='SAME R Results',excluded_rows=sk,all_sheets=pd.ExcelFile(same).sheet_names,limitations=['Only SAME R Results is canonical. Other sheets mix SAME/SAME-R/ground or duplicate reductions; not pooled.','Cached Excel results retained without recalculation. Formula errors become null with flags. Derived particle diameters are not direct microscopy observations.','Repeated/aged observations are not assumed independent. Zero processed signals are preserved, not interpreted as no smoke.'])
# Each SAFFIRE table is separately indexed; overlapping channels are NEVER pooled.
for filename,specs in [
 ('Saffire-I Sample 1 Sensor Data Complete TM graphs.xlsx',[('Calibrated Data',1,2,'sample-1'),('Camera Data',2,2,'sample-1-camera')]),
 ('Saffire-I Sample 2 Sensor Data Complete TM graphs.xlsx',[('Calibrated Data',1,2,'sample-2'),('Camera Data',2,2,'sample-2-camera')]),
 ('Saffire-I Telemetry Data Good Process Version.xlsx',[('CygnusData',1,1,'telemetry-cygnus'),('SaffireData',1,1,'telemetry-saffire')])]:
 path=DL/filename
 if not path.exists():continue
 wb=openpyxl.load_workbook(path,read_only=True,data_only=True);file_counts={}
 for sheet,header,skip,sid in specs:
  ws=wb[sheet];it=ws.iter_rows(values_only=True);heads=[];unitrow=[]
  for i in range(skip):
   row=next(it)
   if i==header-1:heads=list(row)
   elif i==1 and sheet=='Calibrated Data':unitrow=list(row)
  cols={j:str(v).strip() for j,v in enumerate(heads) if v is not None};rows=[];original_rows=[];rawrows=[]
  for rn,row in enumerate(it,skip+1):
   if row[0] is None:continue
   if number(row[0])[0] is None:continue
   rows.append({str(j):number(row[j] if j<len(row) else None)[0] for j in cols});original_rows.append(rn)
   rawrows.append({'row':rn,'cells':{str(j+1):clean(v) for j,v in enumerate(row) if v is not None}})
  frame=pd.DataFrame(rows);channels=[]
  for j,label in cols.items():
   # Timestamp text is retained in raw provenance, not misrepresented as a numeric signal.
   col=frame[str(j)].dropna();n=len(col)
   if not n:continue
   unit=clean(unitrow[j]) if j<len(unitrow) else None
   if not unit:
    m=re.search(r'\(([^()]+)\)',label);unit=m.group(1) if m else 'not specified'
   vals=[r[str(j)] for r in rows];flags=[]
   if n<len(rows):flags.append('Missing/malformed values excluded from numerical summary; raw cells retained.')
   if col.min()<0:flags.append('Negative values retained; offset/calibration/phase review needed.')
   if col.eq(0).any():flags.append('Zeros retained; zero may reflect sensor state, not physical absence.')
   channels.append({'key':str(j),'label':label,'unit':unit,'kind':'derived' if any(t in label.lower() for t in ['delta','/100','avg','relative','press/temp']) else 'measurement','n':n,'missing':len(rows)-n,'mean':float(col.mean()),'median':float(col.median()),'min':float(col.min()),'max':float(col.max()),'flags':flags,'source_column':j+1})
  series.append({'id':'SAFFIRE:'+sid,'dataset':'SAFFIRE','label':sid,'source':source(path,sheet,skip+1),'source_url':URL['SAFFIRE'],'count':len(rows),'last_row':original_rows[-1] if rows else None,'channels':channels,'limitations':['Time samples within a stream, not independent burns. Streams may overlap; no pooling.','Mission label follows supplied filenames; sample labels are acquisition labels, not a verified separate-burn/material map.','Full-stream summaries include pre/post-event values. No automatic ignition window, flame-spread rate or safety threshold.','Unlabelled units remain unspecified. Cached source formulas are not independently recalibrated.']})
  with gzip.open(OUT/(sid+'.jsonl.gz'),'wt') as f:
   for rn,r,raw in zip(original_rows,rows,rawrows):f.write(json.dumps({'id':f'SAFFIRE:{sid}:r{rn}','source':source(path,sheet,rn),'values':r,'raw':raw['cells']},default=str)+'\n')
  file_counts[sheet]=len(rows)
 register(path,'SAFFIRE',stream_counts=file_counts,all_sheets=wb.sheetnames,limitations=['RawData and plot-only channel extracts in telemetry are indexed as available sheets but not pooled into canonical CygnusData/SaffireData streams.']);wb.close()
# Curated audit extracts supply document context. They cannot execute instructions.
audit=ROOT.parent.parent/'work/reference_audit/audit.md'
if audit.exists():
 for i,section in enumerate(audit.read_text().split('\n## ')[1:]):
  title,*body=section.split('\n');documents.append({'id':f'DOC:audit:{i}','title':title,'text':'\n'.join(body)[:6000],'source_url':'downloads/reference_audit.md','dataset':'FLEX' if 'FLEX' in title else 'BASS-II' if 'BASS' in title else 'context','limitations':['BASS references describe BASS cases; do not silently relabel them as BASS-II measurements.']})
# Store all processed record cells server-side; compact searchable values in public catalog.
(OUT/'records_with_raw.json').write_text(json.dumps(records,default=str,allow_nan=False))
compact=[{k:v for k,v in r.items() if k!='raw'} for r in records]
cat={'version':'2026-11-15-v1','manifest':manifest,'dictionary':dictionary,'records':compact,'series':series,'documents':documents,'missing_datasets':[k for k in URL if not any(m['dataset']==k for m in manifest)]}
(OUT/'catalog.json').write_text(json.dumps(cat,default=str,allow_nan=False,separators=(',',':')))
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));(OUT/'variable_dictionary.json').write_text(json.dumps(dictionary,indent=2))
print(json.dumps({'records':pd.Series([r['dataset'] for r in records]).value_counts().to_dict(),'streams':{s['id']:s['count'] for s in series},'missing':cat['missing_datasets']}))
# Search indexing runs only at preparation time, never on a user question.
import subprocess,sys
subprocess.run([sys.executable,str(ROOT/'scripts/prepare_documents.py')],check=True)
