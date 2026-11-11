#!/usr/bin/env python3
"""Public-safe metrics only. Never serialize environment variables or logs."""
import datetime, json, pathlib, shutil, subprocess, time, urllib.request
from checkout_metrics import checkout_metrics
from activity_metrics import activity_metrics
from account_metrics import account_metrics
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
for route in ['/', '/shop', '/cart', '/account', '/test-store', '/_emdash/admin']:
    req = urllib.request.Request('https://backroadbum.com'+route, headers={'User-Agent':'BackroadBum-SelfCheck/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r: health[route] = r.status
    except urllib.error.HTTPError as e: health[route] = e.code
    except Exception: health[route] = None
# GET advisory only: never mint a capability or create a cart/payment during health checks.
checkout = checkout_metrics(None, None)
try:
    req = urllib.request.Request('https://backroadbum.com/api/checkout/health', headers={'User-Agent':'BackroadBum-SelfCheck/1.0'})
    try:
        response = urllib.request.urlopen(req, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response as r:
        checkout = checkout_metrics(json.load(r), r.status)
except Exception:
    pass
# Anonymous read only. SESSION_DENIED means Commerce, not Basic Auth, guards the
# shopper data. This says nothing about sign-in mail or a verified shopper session.
accounts = account_metrics(None, None)
try:
    req = urllib.request.Request('https://backroadbum.com/_emdash/api/plugins/r_gshdrqaldna3r7sn/account/orders',
                                 headers={'User-Agent': 'BackroadBum-SelfCheck/1.0'})
    try:
        response = urllib.request.urlopen(req, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response as r:
        challenge = bool(r.headers.get('WWW-Authenticate'))
        body = json.load(r) if r.headers.get_content_type() == 'application/json' else None
        accounts = account_metrics(body, r.status, challenge)
except Exception:
    pass
# Local Payments and practice Ship are retired. Do not poll their old endpoints;
# historical webhook/wake facts must not be presented as hosted readiness.
disk = shutil.disk_usage('/')
try:
    activity = activity_metrics()
except Exception:
    # Accounting must not take down service/checkout telemetry; never publish exceptions.
    activity = None
result = {'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'services':{name:service(name) for name in ['backroadbum','caddy','backroadbum-payments','backroadbum-ship']}, 'http':health, 'host':{'cpuPercent':cpu(),**memory(),'diskUsedGiB':round(disk.used/2**30,1),'diskTotalGiB':round(disk.total/2**30,1)}, 'checkout':checkout, 'shopperAccounts':accounts, 'paymentsTransport':None, 'usage':{'visitors':None,'orders':None,'tokens':activity['tokens']['totalTokens'] if activity else None,'apiEquivalentUSD':activity['apiEquivalentUSD'] if activity else None}, 'activity':activity, 'backupAt':None}
backups = list((ROOT/'backups').glob('*.tar.gz'))
if backups: result['backupAt'] = datetime.datetime.fromtimestamp(max(p.stat().st_mtime for p in backups),datetime.timezone.utc).isoformat()
p = ROOT/'telemetry.json.tmp'; p.write_text(json.dumps(result)); p.replace(ROOT/'telemetry.json')
