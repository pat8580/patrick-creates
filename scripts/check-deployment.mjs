// Read-only asset checks plus an intentionally invalid enquiry (never creates a lead).
const origin=new URL(process.argv[2]||'https://patrick-creates.vercel.app').origin;
const home=await fetch(origin);if(!home.ok)throw Error('Homepage returned '+home.status);
const html=await home.text();
const assets=[...new Set([...html.matchAll(/["'](\/[\w.-]+\.webp)["']/g)].map(m=>m[1]))];
if(!assets.length)throw Error('No image assets found');
const results=await Promise.all(assets.map(async asset=>{
 const r=await fetch(origin+asset);const bytes=new Uint8Array(await r.arrayBuffer());
 const valid=r.ok&&r.headers.get('content-type')?.startsWith('image/webp')&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(!valid)throw Error('Broken image: '+asset+' ('+r.status+')');return {asset,bytes:bytes.length};
}));
const targets=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for(const match of html.matchAll(/href="#([^"]+)"/g))if(!targets.has(match[1]))throw Error('Broken section link: '+match[1]);
const enquiry=await fetch(origin+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:'{}'});
console.log(JSON.stringify({origin,imagesVerified:results.length,sectionLinks:'passed',enquiryValidationStatus:enquiry.status,enquiryConfigured:enquiry.status===400,images:results},null,2));
if(enquiry.status!==400){console.error('Enquiry service is not ready: check Vercel backend environment variables.');process.exitCode=1;}
