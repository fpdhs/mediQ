"""Manual root-authenticated lock of ONLY the verified B storage mapping."""
import getpass
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('b_storage_operator',ROOT/'scripts/b-pacs-storage-provision.py')
operator=importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)


def main():
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    credential=getpass.getpass('B VM password (concealed): ')
    client=operator.check.connect('B',credential)
    try:
        path='/opt/highpass/storage-lock-'+stamp+'.py'
        with operator.gateway.root_sftp(client,credential) as sftp:
            with sftp.open(path,'wx') as stream:
                stream.write((ROOT/'scripts/b-pacs-storage-guest.py').read_text().replace('\r\n','\n'))
            sftp.chmod(path,0o600)
            sftp.chown(path,0,0)
        result=operator.execute_guest(client,credential,path,{'action':'lock'})
    finally:
        client.close()
        credential=None
    folder=ROOT/'artifacts/workstation'/('b-storage-lock-'+stamp)
    folder.mkdir(parents=True,exist_ok=False)
    result.update(observedAt=datetime.now(timezone.utc).isoformat(),review='DRAFT / UNASSIGNED')
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(folder/'result.json'),**result)))


if __name__=='__main__':main()
