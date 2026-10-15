import copy
import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parent.parent/'scripts/faq-expiry-deployment-preflight.py'
spec = importlib.util.spec_from_file_location('faq_plan',path)
plan = importlib.util.module_from_spec(spec);spec.loader.exec_module(plan)


class RoleBoundary(unittest.TestCase):
    def labels(self,role,ingress=False):
        project='hp-capstone-b-portal' if role=='B' else 'hp-capstone-control'
        stage='/home/'+('server' if role=='B' else 'highpassadmin')+'/.highpass-app-2026-10-08T19-03-15.237525+00-00'
        names=['portal.yml','encryption.yml','patient.yml'] if role=='B' else ['control.yml','ingress.yml','mock.yml','key-release.yml','phantom-catalog.yml','patient.yml']
        if ingress:names+=['patient-ingress-reviewed-20261010.yml']
        return {'com.docker.compose.project':project,'com.docker.compose.project.working_dir':stage,'com.docker.compose.project.config_files':','.join(stage+'/'+name for name in names)}

    def test_exact_role_contexts(self):
        for role in ['B','CLOUD']:
            plan.context(role,self.labels(role))
        plan.context('CLOUD',self.labels('CLOUD',True),ingress=True)
        with self.assertRaises(ValueError):plan.context('CLOUD',self.labels('CLOUD',True))
        with self.assertRaises(ValueError):plan.context('CLOUD',self.labels('CLOUD'),ingress=True)

    def test_wrong_context_rejected(self):
        for key in ['com.docker.compose.project','com.docker.compose.project.working_dir','com.docker.compose.project.config_files']:
            labels=self.labels('B');labels[key]='wrong'
            with self.assertRaises(ValueError):plan.context('B',labels)

    def test_only_role_image_changes(self):
        for role,service,base,image in [('B','portal',plan.UI_BASE,plan.UI),('CLOUD','control',plan.CONTROL_BASE,plan.CONTROL)]:
            baseline={'services':{service:{'image':base,'environment':{'FLAG':'1'}},'postgres':{'image':plan.PG},'ingress':{'image':plan.INGRESS}}}
            candidate=copy.deepcopy(baseline);candidate['services'][service]['image']=image
            plan.image_only(role,baseline,candidate)
            for changed in ['postgres','ingress']:
                bad=copy.deepcopy(candidate);bad['services'][changed]['image']=image
                with self.assertRaises(ValueError):plan.image_only(role,baseline,bad)
            bad=copy.deepcopy(candidate);bad['services'][service]['environment']['FLAG']='0'
            with self.assertRaises(ValueError):plan.image_only(role,baseline,bad)

    def test_generated_program_syntax(self):
        for role in ['B','CLOUD']:compile(plan.remote_program(role),'remote-read-only','exec')


if __name__=='__main__':unittest.main()
