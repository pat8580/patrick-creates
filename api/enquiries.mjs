// Vercel Node function. All backend credentials remain server-side.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({error:'Method not allowed'});
  }
  const backendUrl = process.env.ENQUIRY_BACKEND_URL;
  if (!backendUrl) return res.status(503).json({error:'Enquiry service is not configured'});
  let endpoint;
  try {
    endpoint = new URL('/api/enquiries', backendUrl);
    if (endpoint.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    return res.status(503).json({error:'Enquiry service is not configured'});
  }
  const id = req.headers['idempotency-key'];
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) {
    return res.status(400).json({error:'Invalid submission ID'});
  }
  let body;
  try {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!body || Buffer.byteLength(body) > 16000) return res.status(413).json({error:'Submission too large'});
    JSON.parse(body);
  } catch {
    return res.status(400).json({error:'Invalid submission'});
  }
  const headers = {'Content-Type':'application/json','Idempotency-Key':id,Origin:endpoint.origin};
  if (process.env.SITES_BACKEND_TOKEN) headers['OAI-Sites-Authorization'] = 'Bearer '+process.env.SITES_BACKEND_TOKEN;
  try {
    const upstream = await fetch(endpoint, {method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(15000)});
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status >= 500 ? 503 : upstream.status).json({error:'Could not save your enquiry'});
    if (data.saved !== true || typeof data.id !== 'string') throw new Error('Unexpected backend response');
    return res.status(200).json({saved:true,id:data.id});
  } catch {
    return res.status(503).json({error:'Could not save your enquiry. Please try again.'});
  }
}
