import {test} from 'node:test';import assert from 'node:assert/strict';import {api} from './worker/backend.mjs';
const base={name:'Test Patrick',email:'test@example.com',phone:'',channel:'Email',type:'Website',brief:'A test enquiry.'};
const req=(data,origin='https://example.test')=>new Request('https://example.test/api/enquiries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':'00000000-0000-4000-8000-000000000001'},body:JSON.stringify(data)});
test('rejects cross-origin submission',async()=>assert.equal((await api(req(base,'https://evil.test'),{},{})).status,403));
test('fails honestly without storage',async()=>assert.equal((await api(req(base),{},{})).status,503));
test('WhatsApp requires a country-code number',async()=>assert.equal((await api(req({...base,channel:'WhatsApp'}),{DB:{}},{})).status,400));
test('rejects invalid email and oversized brief',async()=>{for(const d of [{...base,email:'bad'},{...base,brief:'x'.repeat(5001)}])assert.equal((await api(req(d),{DB:{}},{})).status,400)});
test('saves lead and independent notification jobs atomically',async()=>{let writes;const db={prepare(sql){return {bind(...args){return {sql,args,first:async()=>null}}}},async batch(items){writes=items}};let work;const res=await api(req(base),{DB:db},{waitUntil(p){work=p}});assert.equal(res.status,200);assert.equal(writes.length,3);assert.match(writes[0].sql,/INSERT OR IGNORE/);assert.equal(writes[1].args[2],'email');assert.equal(writes[2].args[2],'whatsapp');assert.equal((await res.json()).saved,true);await work});
