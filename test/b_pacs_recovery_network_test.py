import ast
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class RecoveryNetworkSafety(unittest.TestCase):
    def test_generated_programs_parse_before_remote_execution(self):
        source=(ROOT/'scripts/b-pacs-recovery-network.py').read_text()
        programs=[n.value for n in ast.walk(ast.parse(source)) if isinstance(n,ast.Constant) and isinstance(n.value,str) and n.value.startswith(('import subprocess,json,pathlib','path=pathlib.Path('))]
        self.assertGreaterEqual(len(programs),4)
        for program in programs:compile(program,'remote-safety-check','exec')
        for program in programs:
            compile(program.replace('EXPECTED',repr('a'*64)).replace('__PEER__',repr('public-peer-key')),'rendered-remote-check','exec')

    def test_no_broad_rule_flush_or_tunnel_restart(self):
        source=(ROOT/'scripts/b-pacs-recovery-network.py').read_text()
        self.assertIn("'-d','10.89.1.5/32','-p','tcp','--dport','443'",source)
        for text in ["'0.0.0.0/0'","'10.89.1.0/24'","'flush'","'wg-quick','down'","'iptables','-F'"]:
            self.assertNotIn(text,source)
        self.assertIn("'CONFIG_CHANGED'",source)
        self.assertIn("open(backup,'xb')",source)

if __name__=='__main__':unittest.main()
