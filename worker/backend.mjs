const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const types=['Landing Page','Sales Funnel','Website','Not Sure Yet'];
async function notify(env,id){
 const lead=await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first(); if(!lead)return;
 const jobs=await env.DB.prepare("SELECT * FROM notifications WHERE lead_id = ? AND status IN ('pending','failed') AND (next_attempt_at IS NULL OR next_attempt_at <= ?) AND attempts < 8").bind(id,new Date().toISOString()).all();
 await Promise.all(jobs.results.map(async job=>{
  const ready=job.channel==='email'?env.RESEND_API_KEY&&env.PATRICK_EMAIL&&env.EMAIL_FROM:env.WHATSAPP_ACCESS_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID&&env.WHATSAPP_TEMPLATE_NAME&&env.PATRICK_WHATSAPP;
  if(!ready)return;
  const claimed=await env.DB.prepare("UPDATE notifications SET status = 'sending', attempts = attempts + 1 WHERE id = ? AND status IN ('pending','failed')").bind(job.id).run();if(!claimed.meta.changes)return;
  try{
   let response;
   if(job.channel==='email')response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:env.EMAIL_FROM,to:[env.PATRICK_EMAIL],reply_to:lead.email,subject:'Project enquiry: '+lead.name+' — '+lead.project_type,text:`Lead ID: ${lead.id}\nSubmitted: ${lead.created_at}\nName: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone||'Not provided'}\nPreferred reply: ${lead.reply_channel}\nProject: ${lead.project_type}\n\n${lead.brief}`})});
   else response=await fetch('https://graph.facebook.com/v23.0/'+env.WHATSAPP_PHONE_NUMBER_ID+'/messages',{method:'POST',headers:{Authorization:'Bearer '+env.WHATSAPP_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:env.PATRICK_WHATSAPP,type:'template',template:{name:env.WHATSAPP_TEMPLATE_NAME,language:{code:env.WHATSAPP_TEMPLATE_LANGUAGE||'en'},components:[{type:'body',parameters:[{type:'text',text:lead.name},{type:'text',text:lead.project_type},{type:'text',text:lead.reply_channel}]}]}})});
   const result=await response.json();if(!response.ok)throw Error('Provider rejected notification');const providerId=result.id||result.messages?.[0]?.id||'';
   await env.DB.prepare("UPDATE notifications SET status = 'accepted', provider_id = ?, last_error = NULL, updated_at = ? WHERE id = ?").bind(providerId,new Date().toISOString(),job.id).run();
  }catch{const next=new Date(Date.now()+Math.min(24*3600000,60000*2**job.attempts)).toISOString();await env.DB.prepare("UPDATE notifications SET status = 'failed', last_error = 'Delivery request failed; retry scheduled', next_attempt_at = ?, updated_at = ? WHERE id = ?").bind(next,new Date().toISOString(),job.id).run()}
 }));
}
async function verifyHmac(secret, payload, signature, encoding='hex') {
 const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
 const actual=encoding==='hex'?Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''):btoa(String.fromCharCode(...bytes));
 if(signature.length!==actual.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^signature.charCodeAt(i);return diff===0;
}
async function webhooks(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/api/webhooks/whatsapp'){
  if(request.method==='GET'){if(env.WHATSAPP_VERIFY_TOKEN&&url.searchParams.get('hub.verify_token')===env.WHATSAPP_VERIFY_TOKEN)return new Response(url.searchParams.get('hub.challenge'));return new Response('Forbidden',{status:403})}
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  const raw=await request.text();if(!env.META_APP_SECRET||!await verifyHmac(new TextEncoder().encode(env.META_APP_SECRET),raw,(request.headers.get('x-hub-signature-256')||'').replace(/^sha256=/,'')))return new Response('Forbidden',{status:403});
  let data;try{data=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400})}
  for(const entry of data.entry||[])for(const change of entry.changes||[])for(const status of change.value?.statuses||[]){
   if(!['sent','delivered','read','failed'].includes(status.status))continue;
   await env.DB.prepare("UPDATE notifications SET status = ?, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE channel = 'whatsapp' AND provider_id = ? AND status NOT IN ('read','delivered')").bind(status.status,status.status==='failed'?'Provider reported delivery failure':null,status.status==='failed'?new Date(Date.now()+60000).toISOString():null,new Date().toISOString(),status.id).run();
  }return json({received:true});
 }
 if(url.pathname==='/api/webhooks/email'&&request.method==='POST'){
  const raw=await request.text(),id=request.headers.get('svix-id'),timestamp=request.headers.get('svix-timestamp');
  if(!env.RESEND_WEBHOOK_SECRET||!id||!timestamp||Math.abs(Date.now()/1000-Number(timestamp))>300)return new Response('Forbidden',{status:403});
  let secret;try{secret=Uint8Array.from(atob(env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/,'')),c=>c.charCodeAt(0))}catch{return new Response('Forbidden',{status:403})}
  let valid=false;for(const candidate of (request.headers.get('svix-signature')||'').split(' ')){const [version,signature]=candidate.split(',');if(version==='v1'&&await verifyHmac(secret,id+'.'+timestamp+'.'+raw,signature,'base64'))valid=true}if(!valid)return new Response('Forbidden',{status:403});
  let data;try{data=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400})}
  const state={'email.delivered':'delivered','email.bounced':'bounced','email.failed':'failed','email.complained':'complained'}[data.type];
  if(state)await env.DB.prepare("UPDATE notifications SET status = ?, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE channel = 'email' AND provider_id = ? AND status != 'delivered'").bind(state,state==='failed'?'Provider reported delivery failure':null,state==='failed'?new Date(Date.now()+60000).toISOString():null,new Date().toISOString(),data.data?.email_id||'').run();
  return json({received:true});
 }
 return null;
}
export async function api(request,env,ctx){
 const url=new URL(request.url);
 const hook=await webhooks(request,env);if(hook)return hook;
 if(url.pathname==='/api/enquiries'&&request.method==='POST'){
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Invalid origin'},403);
  if(!env.DB)return json({error:'Enquiry service is not configured'},503);
  if(Number(request.headers.get('Content-Length')||0)>16000)return json({error:'Too large'},413);
  let d;try{const raw=await request.text();if(raw.length>16000)return json({error:'Too large'},413);d=JSON.parse(raw)}catch{return json({error:'Invalid submission'},400)}
  if(d.company_url)return json({error:'Invalid submission'},400);
  const name=String(d.name||'').trim(),email=String(d.email||'').trim(),phone=String(d.phone||'').trim(),brief=String(d.brief||'').trim();
  const id=request.headers.get('Idempotency-Key');if(!id||! /^[a-f0-9-]{36}$/.test(id)||!name||name.length>120||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!types.includes(d.type)||!['Email','WhatsApp'].includes(d.channel)||!brief||brief.length>5000||phone.length>30||((phone||d.channel==='WhatsApp')&&!/^\+[1-9][\d\s()-]{6,25}$/.test(phone)))return json({error:'Please check your details'},400);
  try{const now=new Date().toISOString();await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO leads (id, created_at, name, email, phone, reply_channel, project_type, brief) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id,now,name,email,phone,d.channel,d.type,brief),
   ...['email','whatsapp'].map(c=>env.DB.prepare("INSERT OR IGNORE INTO notifications (id, lead_id, channel, status, attempts, updated_at) VALUES (?, ?, ?, 'pending', 0, ?)").bind(id+'-'+c,id,c,now))
  ]);ctx.waitUntil(notify(env,id));return json({id,saved:true})}catch{return json({error:'Could not save your enquiry'},503)}
 }
 if(url.pathname==='/api/notifications/retry'&&request.method==='POST'){
  if(!env.RETRY_SECRET||request.headers.get('Authorization')!=='Bearer '+env.RETRY_SECRET)return json({error:'Unauthorized'},401);
  const rows=await env.DB.prepare("SELECT DISTINCT lead_id FROM notifications WHERE status IN ('pending','failed') AND attempts < 8 AND (next_attempt_at IS NULL OR next_attempt_at <= ?) LIMIT 50").bind(new Date().toISOString()).all();
  await Promise.all(rows.results.map(row=>notify(env,row.lead_id)));return json({processed:rows.results.length});
 }
 return null;
}
export async function scheduled(event,env,ctx){const rows=await env.DB.prepare("SELECT DISTINCT lead_id FROM notifications WHERE status IN ('pending','failed') AND attempts < 8 LIMIT 50").all();ctx.waitUntil(Promise.all(rows.results.map(row=>notify(env,row.lead_id))))}
