import datetime, importlib.util, json, pathlib, unittest
spec=importlib.util.spec_from_file_location('collector',pathlib.Path(__file__).resolve().parents[1]/'scripts/collect-waf-audit.py');collector=importlib.util.module_from_spec(spec);spec.loader.exec_module(collector)
class CollectorTest(unittest.TestCase):
 def test_warning_is_not_block_and_raw_fields_not_copied(self):
  now=datetime.datetime.now(datetime.timezone.utc)
  row={'logger':'http.handlers.waf','ts':now.timestamp()-1,'level':'error','msg':'Warning. [id "930130"] secret matched data','unique_id':'private','client_ip':'1.2.3.4','uri':'/?token=secret'}
  value=collector.sanitize(json.dumps(row),now)
  self.assertEqual(value['events'][0]['result'],'DETECTED');self.assertNotIn('secret',json.dumps(value));self.assertNotIn('private',json.dumps(value));self.assertNotIn('1.2.3.4',json.dumps(value))
  row['msg']='Access denied with code 403 [id "930130"]'
  self.assertEqual(collector.sanitize(json.dumps(row),now)['events'][0]['result'],'DENIED')
 def test_future_nonwaf_and_duplicate_events(self):
  now=datetime.datetime.now(datetime.timezone.utc);row={'logger':'other','ts':now.timestamp()-1,'msg':'[id "930130"]'}
  self.assertEqual(collector.sanitize(json.dumps(row),now)['events'],[])
  row['logger']='http.handlers.waf';raw=json.dumps(row)
  self.assertEqual(len(collector.sanitize(raw+'\n'+raw,now)['events']),1)
if __name__=='__main__':unittest.main()
