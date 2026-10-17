"""Fixed-source, bounded WAF collector. Never persists IP, URL, matched data or bodies."""
import datetime, hashlib, json, os, pathlib, re, subprocess

def sanitize(raw, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    events = {}
    for line in raw.splitlines():
        try:
            item = json.loads(line)
            if not isinstance(item, dict) or item.get('logger') != 'http.handlers.waf': continue
            stamp = item.get('ts')
            if isinstance(stamp, bool) or not isinstance(stamp, (int, float)): continue
            time = datetime.datetime.fromtimestamp(stamp, datetime.timezone.utc)
            if not now-datetime.timedelta(hours=24) <= time <= now: continue
            message = str(item.get('msg', ''))
            # An error-level Caddy message or a Coraza warning is NOT proof of blocking.
            result = 'DENIED' if re.search(r'Access denied with code (?:403|406)\b', message, re.I) else 'DETECTED'
            for rule in set(re.findall(r'\[id "(\d{4,8})"\]', message)):
                ref = hashlib.sha256((str(item.get('unique_id', ''))+'|'+rule+'|'+time.isoformat()).encode()).hexdigest()[:24]
                events[ref] = {'eventRef': ref, 'time': time.isoformat(), 'ruleId': rule, 'result': result}
        except (ValueError, TypeError, OverflowError, OSError): continue
    return {'status':'available','observedAt':now.isoformat(),'windowHours':24,'scope':'BOUNDED_WAF_RULE_EVENTS',
            'truncatedPossible':True,'events':sorted(events.values(),key=lambda x:x['time'],reverse=True)[:500]}

def main():
    destination = pathlib.Path('/opt/highpass/security-release-e4888f02b2dd4a8295a7f0426025b6e0/audit-extension/socket/waf-events.json')
    temporary = destination.with_suffix('.pending')
    try:
        # File-backed subprocess output is deliberately not used: raw events stay in memory only.
        process = subprocess.Popen(['docker','logs','--since','24h','--tail','3000','hp-public-web-waf-1'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        try:
            import selectors, time
            selector=selectors.DefaultSelector();selector.register(process.stdout,selectors.EVENT_READ)
            deadline=time.monotonic()+10;chunks=[];size=0;eof=False
            while time.monotonic()<deadline and size<2097152:
                ready=selector.select(max(0,min(1,deadline-time.monotonic())))
                if not ready:
                    if process.poll() is not None:break
                    continue
                chunk=os.read(process.stdout.fileno(),min(65536,2097152-size))
                if not chunk:eof=True;break
                chunks.append(chunk);size+=len(chunk)
            if eof:
                try:process.wait(timeout=1)
                except subprocess.TimeoutExpired:process.kill()
            elif process.poll() is None:process.kill()
            process.wait(timeout=2)
            if process.returncode != 0:raise RuntimeError('WAF_LOG_READ_FAILED')
            result=sanitize(b''.join(chunks).decode(errors='replace'))
        finally:
            if process.poll() is None:process.kill();process.wait()
    except Exception:
        result={'status':'unavailable','observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'events':[]}
    descriptor=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o640)
    with os.fdopen(descriptor,'w') as output:json.dump(result,output);output.flush();os.fsync(output.fileno())
    os.chown(temporary,0,65532);os.chmod(temporary,0o640);os.replace(temporary,destination)

if __name__=='__main__':main()
