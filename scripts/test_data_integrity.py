"""Independent source checks; raw files are read-only. No API/network calls."""
from pathlib import Path
import json,unittest,os,gzip
import pandas as pd,openpyxl
R=Path(__file__).resolve().parents[1];c=json.loads((R/'data/prepared/catalog.json').read_text());D=Path(os.environ.get('NASA_DOWNLOADS_DIR',str(Path.home()/'Downloads')));N=Path(os.environ.get('NASA_DATA_DIR',str(Path.home()/'Documents/hackathon/NASA')))
class Integrity(unittest.TestCase):
 def test_flex_row_and_raw_value_reconciliation(self):
  p=D/'PSI-69_Experimental table_FLEX.csv';d=pd.read_csv(p,encoding='cp1252',keep_default_na=False);records=[r for r in c['records'] if r['dataset']=='FLEX'];self.assertEqual(len(d),len(records));self.assertEqual(len(d),274)
  for rec in records:self.assertEqual(str(d.iloc[rec['source']['row']-2,0]),rec['experiment_id'])
 def test_bass_rows_materials_and_unit_preservation(self):
  d=pd.read_csv(N/'PSI-25_Experimental table_BASS-II.csv',encoding='utf-8-sig',keep_default_na=False);r=[r for r in c['records'] if r['dataset']=='BASS-II'];self.assertEqual(len(d),len(r));self.assertEqual(c['dictionary']['BASS-II']['oxygen']['unit'],'% by volume');self.assertEqual(r[0]['values']['oxygen'],float(d.iloc[0,11]))
 def test_same_only_identified_canonical_records(self):
  d=pd.read_excel(D/'Combined SAMER Results 06 02 14.xlsx',sheet_name='SAME R Results',header=1);ids=d.iloc[:,3].dropna();records=[r for r in c['records'] if r['dataset']=='SAME-R'];self.assertEqual(len(ids),len(records));self.assertEqual(len(ids),109);self.assertTrue(all(r['source']['sheet']=='SAME R Results' for r in records));self.assertTrue(any(r['values']['mean_diameter'] is None for r in records))
 def test_source_keyed_stream_counts_and_provenance(self):
  for filename in sorted({s['source']['file'] for s in c['series']}):
   wb=openpyxl.load_workbook(D/filename,read_only=True,data_only=True)
   for s in [s for s in c['series'] if s['source']['file']==filename]:
    first=s['source']['row'];keyed=[]
    for n,row in enumerate(wb[s['source']['sheet']].iter_rows(min_row=first,values_only=True),first):
     if isinstance(row[0],(int,float)):keyed.append(n)
    self.assertEqual(len(keyed),s['count']);self.assertEqual(keyed[-1],s['last_row'])
    with gzip.open(R/'data/prepared'/f"{s['label']}.jsonl.gz",'rt') as f:parsed=[json.loads(l) for l in f]
    self.assertEqual(len(parsed),s['count']);self.assertEqual(parsed[0]['source']['row'],keyed[0]);self.assertIn('raw',parsed[0])
   wb.close()
 def test_known_source_measurement(self):
  r=next(r for r in c['records'] if r['dataset']=='FLEX' and r['experiment_id']=='5');self.assertEqual(r['values']['diameter'],1.92);self.assertEqual(r['values']['burning_rate'],.48);self.assertEqual(r['values']['burn_time'],6.34)
if __name__=='__main__':unittest.main()
