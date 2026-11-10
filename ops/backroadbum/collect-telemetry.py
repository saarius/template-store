#!/usr/bin/env python3
"""Public-safe metrics only. Never serialize environment variables or logs."""
import datetime, json, pathlib, shutil, subprocess, time, urllib.request
from payments_metrics import payments_metrics
ROOT = pathlib.Path('/var/lib/backroadbum')
def service(name):
    p = subprocess.run(['systemctl', 'is-active', name], capture_output=True, text=True)
    return p.stdout.strip() or 'unavailable'
def memory():
    values = {}
    for line in pathlib.Path('/proc/meminfo').read_text().splitlines():
        key, value = line.split(':', 1)
        values[key] = int(value.strip().split()[0])
    return {'totalMiB': round(values['MemTotal']/1024), 'usedMiB': round((values['MemTotal']-values['MemAvailable'])/1024), 'swapUsedMiB': round((values['SwapTotal']-values['SwapFree'])/1024)}
def cpu():
    def read(): return [int(v) for v in pathlib.Path('/proc/stat').read_text().splitlines()[0].split()[1:9]]
    a = read(); time.sleep(.2); b = read()
    total = sum(b)-sum(a); idle = (b[3]+b[4])-(a[3]+a[4])
    return round(100*(total-idle)/total, 1) if total else None
health = {}
for route in ['/', '/shop', '/cart', '/test-store', '/_emdash/admin']:
    req = urllib.request.Request('https://backroadbum.com'+route, headers={'User-Agent':'BackroadBum-SelfCheck/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r: health[route] = r.status
    except urllib.error.HTTPError as e: health[route] = e.code
    except Exception: health[route] = None
# The public gate is separate from private payment proof. A refusal is not a payment result.
try:
    req = urllib.request.Request('https://backroadbum.com/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/prepare',data=b'{}',headers={'Content-Type':'application/json','User-Agent':'BackroadBum-SelfCheck/1.0'})
    with urllib.request.urlopen(req, timeout=10) as r: checkout = r.status
except urllib.error.HTTPError as e: checkout = e.code
except Exception: checkout = None
# Loopback liveness is not proof that Commerce is connected or an order was paid.
transport = None
try:
    with urllib.request.urlopen('http://127.0.0.1:8787/health', timeout=3) as response:
        transport = payments_metrics(json.load(response), response.status)
except Exception:
    pass
disk = shutil.disk_usage('/')
result = {'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'services':{name:service(name) for name in ['backroadbum','caddy','backroadbum-payments']}, 'http':health, 'host':{'cpuPercent':cpu(),**memory(),'diskUsedGiB':round(disk.used/2**30,1),'diskTotalGiB':round(disk.total/2**30,1)}, 'checkout':{'state':'refused' if checkout in (401,403,503) else 'unverified','prepareHttp':checkout,'lastPaidTestAt':None}, 'paymentsTransport':transport, 'usage':{'visitors':None,'orders':None,'tokens':None,'apiEquivalentUSD':None}, 'backupAt':None}
backups = list((ROOT/'backups').glob('*.tar.gz'))
if backups: result['backupAt'] = datetime.datetime.fromtimestamp(max(p.stat().st_mtime for p in backups),datetime.timezone.utc).isoformat()
p = ROOT/'telemetry.json.tmp'; p.write_text(json.dumps(result)); p.replace(ROOT/'telemetry.json')
