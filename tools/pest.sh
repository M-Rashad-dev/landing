#!/usr/bin/env bash
# Runs Pest and prints a compact summary (pass/fail + failure messages).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/tools/env.sh"
cd "$ROOT/back" || exit 1
php vendor/bin/pest "$@" 2>&1 | PYTHONIOENCODING=utf-8 python -c "
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print(raw[-4000:]); sys.exit(1)
print(d['result'], 'tests=%s' % d.get('tests'), 'failed=%s' % d.get('failed'), 'errors=%s' % d.get('errors'))
for f in d.get('failures', []) + d.get('error_details', []):
    print('-', f['test'][-120:], '|', f['message'][:800])
sys.exit(0 if d['result'] == 'passed' else 1)
"
