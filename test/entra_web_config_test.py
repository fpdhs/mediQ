import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('entra_web',pathlib.Path(__file__).resolve().parents[1]/'scripts/entra-web-config.py')
web=importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)

class EntraWebConfiguration(unittest.TestCase):
    def users(self):
        return [dict(role=role,objectId=oid,userType='Guest',externalUserState='Accepted') for role,oid in
                [('PATIENT','11111111-1111-4111-8111-111111111111'),('DOCTOR','22222222-2222-4222-8222-222222222222')]]

    def test_exact_synthetic_mapping(self):
        mapping=web.actor_map(self.users())
        self.assertEqual(mapping['tenantId'],web.TENANT)
        self.assertEqual(mapping['actors'][0]['patientId'],'MEDIQ-SYN-HCC-001')
        self.assertEqual(mapping['actors'][1]['hospitalId'],'HOSP-B')
        self.assertFalse(any('email' in actor for actor in mapping['actors']))

    def test_unaccepted_duplicate_and_unassigned_roles_denied(self):
        for field,value in [('externalUserState','PendingAcceptance'),('userType','Member'),('role','PLATFORM_ADMIN'),('objectId','invalid')]:
            users=self.users();users[0][field]=value
            with self.assertRaises(ValueError): web.actor_map(users)
        users=self.users();users[1]['objectId']=users[0]['objectId']
        with self.assertRaises(ValueError): web.actor_map(users)

    def test_no_broad_permission_and_no_public_redirect(self):
        source=pathlib.Path(web.__file__).read_text(encoding='utf8')
        self.assertIn("parser.add_argument('--apply', action='store_true')",source)
        self.assertNotIn('oauth2PermissionGrants',source)
        self.assertNotIn('roleAssignments',source)
        self.assertEqual(web.REDIRECT,'https://192.168.111.149:9443/entra-redirect.html')

if __name__=='__main__': unittest.main()
