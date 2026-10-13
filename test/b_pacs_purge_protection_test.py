import copy
import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('purge_protection',ROOT/'scripts/b-pacs-enable-purge-protection.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def baseline():
    return dict(id=module.VAULT_ID,location='japaneast',properties=dict(tenantId=module.TENANT,
        provisioningState='Succeeded',enableSoftDelete=True,softDeleteRetentionInDays=7,
        publicNetworkAccess='Disabled',enableRbacAuthorization=True,enablePurgeProtection=None))


class PurgeProtectionSafety(unittest.TestCase):
    def test_exact_approved_baseline(self):
        module.validate_baseline(dict(id=module.SUBSCRIPTION,tenantId=module.TENANT),baseline())

    def test_changed_security_or_retention_rejected(self):
        for field,value in [('softDeleteRetentionInDays',90),('publicNetworkAccess','Enabled'),
                            ('enableRbacAuthorization',False),('enableSoftDelete',False),('tenantId','other')]:
            vault=baseline()
            vault['properties'][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):
                module.validate_baseline(dict(id=module.SUBSCRIPTION,tenantId=module.TENANT),vault)

    def test_other_resource_rejected(self):
        vault=baseline()
        vault['id']=module.VAULT_ID+'-other'
        with self.assertRaises(ValueError):module.validate_baseline(dict(id=module.SUBSCRIPTION,tenantId=module.TENANT),vault)

    def test_wrong_subscription_rejected(self):
        with self.assertRaises(ValueError):module.validate_baseline(dict(id='other',tenantId=module.TENANT),baseline())

    def test_patch_only_enables_never_disables(self):
        self.assertEqual(module.PATCH_BODY,{'properties':{'enablePurgeProtection':True}})

    def test_stable_properties_excludes_only_expected_transitions(self):
        first=baseline()
        second=copy.deepcopy(first)
        second['properties']['enablePurgeProtection']=True
        self.assertEqual(module.stable_properties(first),module.stable_properties(second))
        second['properties']['publicNetworkAccess']='Enabled'
        self.assertNotEqual(module.stable_properties(first),module.stable_properties(second))


if __name__=='__main__':unittest.main()
