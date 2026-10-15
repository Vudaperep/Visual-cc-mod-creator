import sys,re,json
# Seeds a generated panel's state with sample data, so a render test draws every row of every widget.
p=sys.argv[1]; r=open(p).read()
panel=json.loads(r[r.index('const PANEL: Panel = ')+len('const PANEL: Panel = '):r.index('\n\nconst PANE ')])
N='1_800_000_000_000'
seed={
'agents': f"[{{ id: 'a1', description: 'refactor auth', type: 'general-purpose', status: 'running', firstSeenMs: {N} - 60000, steps: 3, tools: 9, outTokens: 2000, ctxTokens: 38000, model: 'claude-sonnet-5-5', lastTool: 'Edit' }}, {{ id: 'a2', description: 'done one', type: 'Explore', status: 'completed', firstSeenMs: {N} - 900000, endedMs: {N} - 10000, steps: 9, tools: 41, outTokens: 12000, ctxTokens: 101000, durationMs: 336000 }}]",
'tools': f"[{{ id: 't1', tool: 'Bash', detail: 'npm test', startedMs: {N} - 3000, endedMs: {N}, isError: true, denied: false }}, {{ id: 't2', tool: 'Read', detail: 'x', startedMs: {N}, agentId: 'a1' }}]",
'usage': f"{{ startedAt: {N} - 3600000, tokens: 92000, window: 200000, percent: 46, usd: 3.41, limits: [{{ kind: 'five_hour', percentUsed: 31, resetsAt: '23:00' }}] }}",
'git': "{ branch: 'main', ahead: 2, behind: 1, files: [' M a.ts', '?? b/', ' D c.ts'], last: 'abc fix' }",
'peers': f"[{{ pid: 1, sessionId: 's1', name: 'me', cwd: '/Users/x/p', status: 'busy', kind: 'interactive', updatedAt: {N}, isSelf: true }}, {{ pid: 2, sessionId: 's2', name: 'other', cwd: '/Users/x/q', status: 'idle', kind: 'interactive', updatedAt: {N} - 5000, isSelf: false }}]",
'info': "{ model: 'claude-opus-5-5', turns: 4, cwd: '/Users/x/p', sessionId: 's1' }",
'messages': "[{ role: 'user', text: 'hello there', tools: [] }, { role: 'assistant', text: 'hi', tools: ['Read', 'Bash'] }, { role: 'assistant', text: '', tools: ['Edit'] }]",
'inventory': "{ tools: [{ name: 'Bash', mcp: false }, { name: 'mcp__x__y', mcp: true }], commands: [{ name: 'compact', description: 'Compact the conversation' }, { name: 'cost', description: 'Show cost' }] }",
'turn': f"{{ id: 'turn1', startedMs: {N} - 42000 }}",
'ctxHistory': "[10, 20, 35, 46, 60, 85]",
}
diff="diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1,2 +1,2 @@\n-old\n+new\n ctx"
out={}; exp={}; notes={}
for w in panel['widgets']:
    k=w['kind']; i=w['id']
    if k in ('ask','aiAction','selection'): out[i]='**answer** text'
    elif k=='nextStep': out[i]='Run the tests'
    elif k=='diff': out[i]=diff
    elif k in ('http','mcp','shell','file'): out[i]='200 · ok'
    if k=='inventory': exp[i]=True
    if k=='notes': notes[i]=['one','two']
seed['outputs']=json.dumps(out, ensure_ascii=False); seed['expanded']=json.dumps(exp); seed['notes']=json.dumps(notes)
for k,v in seed.items():
    r,n=re.subn(r"(const S_%s = atom\(\{ plugin: '[\w-]+', key: '%s' \} as const, )(.*?)\)\n"%(k,k), lambda m: m.group(1)+v.replace('\\','\\\\')+" as any)\n", r)
    assert n==1,k
open(p,'w').write(r)
print('seeded', len(seed), 'widgets', len(panel['widgets']))
