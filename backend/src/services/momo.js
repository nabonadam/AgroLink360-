// MTN MoMo Collection API wrapper (sandbox-ready).
//
// In sandbox / when credentials are absent, initiateCollection() returns a
// simulated reference so the order flow works end-to-end. Wire the real calls
// (commented) once you have MoMo developer credentials.

const {
  MOMO_ENV = 'sandbox',
  MOMO_SUBSCRIPTION_KEY,
  MOMO_API_USER,
  MOMO_API_KEY,
} = process.env;

const BASE =
  MOMO_ENV === 'production'
    ? 'https://proxy.momoapi.mtn.com'
    : 'https://sandbox.momodeveloper.mtn.com';

function credentialsPresent() {
  return Boolean(MOMO_SUBSCRIPTION_KEY && MOMO_API_USER && MOMO_API_KEY);
}

// Request payment from a customer's mobile-money wallet.
export async function initiateCollection({ amount, msisdn, externalId, payerMessage }) {
  if (!credentialsPresent()) {
    // Simulated success path for local development
    return { ref: 'SIM-' + Math.random().toString(36).slice(2, 10), simulated: true, status: 'pending' };
  }

  // ── Real MTN MoMo Collection "requesttopay" ──
  // 1) Obtain an OAuth token:
  //    POST {BASE}/collection/token/  (Basic auth: API_USER:API_KEY, Ocp-Apim-Subscription-Key)
  // 2) Create the request:
  //    POST {BASE}/collection/v1_0/requesttopay
  //      headers: X-Reference-Id (uuid), X-Target-Environment, Ocp-Apim-Subscription-Key, Authorization: Bearer
  //      body: { amount, currency:'GHS', externalId, payer:{partyIdType:'MSISDN', partyId: msisdn}, payerMessage }
  //
  // const token = await getToken();
  // const ref = crypto.randomUUID();
  // await fetch(`${BASE}/collection/v1_0/requesttopay`, { ... });
  // return { ref, simulated: false, status: 'pending' };

  throw new Error('MoMo credentials present but live calls are not yet wired — see services/momo.js');
}

// Poll a collection's status: 'PENDING' | 'SUCCESSFUL' | 'FAILED'
export async function collectionStatus(ref) {
  if (ref.startsWith('SIM-')) return { status: 'successful', simulated: true };
  // GET {BASE}/collection/v1_0/requesttopay/{ref}
  throw new Error('Implement live MoMo status polling in services/momo.js');
}
