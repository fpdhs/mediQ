"""Offline invitation safety contract; not evidence of actual login."""
import ast
import pathlib
import unittest


class InviteSafety(unittest.TestCase):
    def test_resend_preserves_pending_guest_identity(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'scripts/entra-demo-users.py').read_text()
        self.assertIn('RESEND_REQUIRES_EXPLICIT_APPLY', source)
        self.assertIn('EXISTING_PENDING_GUEST_REQUIRED', source)
        self.assertIn('RESEND_OBJECT_ID_MISMATCH', source)
        self.assertIn('resetRedemption=False', source)
        self.assertNotIn('resetRedemption=True', source)

    def test_invitation_only_guest_no_password_or_admin(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'scripts/entra-demo-users.py').read_text()
        ast.parse(source)
        self.assertIn("invitedUserType='Guest'", source)
        self.assertIn('sendInvitationMessage=True', source)
        self.assertIn("inviteRedirectUrl='https://myapps.microsoft.com/'", source)
        self.assertNotIn('passwordProfile', source)
        self.assertNotIn('/appRoleAssignments', source)
        self.assertNotIn('/roleAssignments', source)

    def test_identity_and_evidence_guards(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'scripts/entra-demo-users.py').read_text()
        for guard in ['TWO_DISTINCT_VALID_EMAILS_REQUIRED', 'IGNORED_ARTIFACT_DIRECTORY_REQUIRED',
                      'PROTECTED_ARTIFACT_ACL_REQUIRED', 'APPROVED_TENANT_REQUIRED', 'AMBIGUOUS_EXISTING_IDENTITY']:
            self.assertIn(guard, source)
        self.assertNotIn('inviteRedeemUrl', source)
        self.assertIn("if k != 'objectId'", source)
        self.assertNotIn('@gmail.com', source)


if __name__ == '__main__':
    unittest.main()
