import importlib.util
import pathlib
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('restore_guest_safety',ROOT/'scripts/b-pacs-vault-restore-guest.py')
guest=importlib.util.module_from_spec(spec);spec.loader.exec_module(guest)
spec2=importlib.util.spec_from_file_location('restore_infra_safety',ROOT/'scripts/b-pacs-audit-recovery-infra.py')
infra=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(infra)

class RestoreSafety(unittest.TestCase):
    def test_external_host_ip_and_non_storage_key_rejected_before_connection(self):
        with patch.object(guest.http.client,'HTTPSConnection') as conn:
            for host,ip,path in [('evil.example','10.89.1.5','/keys/restore'),(guest.RECOVERY,'1.1.1.1','/keys/restore'),(guest.PRIMARY,'10.89.1.5','/keys/'+guest.NAME),(guest.PRIMARY,'10.89.1.4','/keys/restore'),(guest.RECOVERY,'10.89.1.5','/keys/other'),(guest.RECOVERY,'10.89.1.5','/keys/'+guest.NAME+'/delete')]:
                with self.subTest(host=host,ip=ip,path=path),self.assertRaises(ValueError):guest.pinned_request('not-real-token',host,ip,path)
            conn.assert_not_called()

    def test_exact_private_vault_policy(self):
        p=dict(enableRbacAuthorization=True,enableSoftDelete=True,enablePurgeProtection=True,publicNetworkAccess='Disabled',softDeleteRetentionInDays=7)
        v={'id':infra.BASE+'/providers/Microsoft.KeyVault/vaults/'+infra.RECOVERY,'location':'japaneast','properties':p}
        infra.validate_vault(v)
        for key,value in [('publicNetworkAccess','Enabled'),('enableRbacAuthorization',False),('enablePurgeProtection',False),('softDeleteRetentionInDays',90)]:
            with self.subTest(key=key),self.assertRaises(RuntimeError):infra.validate_vault({**v,'properties':{**p,key:value}})

    def test_no_key_delete_disable_or_raw_key_output(self):
        source=(ROOT/'scripts/b-pacs-vault-restore-guest.py').read_text()
        self.assertIn('hmac.compare_digest(keys[0],keys[1])',source)
        self.assertIn('server_hostname=host',source)
        self.assertNotIn('CERT_NONE',source)
        self.assertNotIn("print(key",source)
        self.assertNotIn("'DELETE'",source)
        self.assertNotIn('write_bytes',source)

if __name__=='__main__':unittest.main()
