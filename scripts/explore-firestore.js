const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const creds = require('./firebase_credentials.json');

const app = initializeApp({ credential: cert(creds) }, 'explorer');
const db = getFirestore(app);

(async () => {
  try {
    console.log('Connecting to project:', creds.project_id);

    // 1. Daily stats
    const stats = await db.collection('daily_stats').get();
    console.log('\n=== DAILY STATS (' + stats.size + ' docs) ===');
    stats.docs.forEach(d => console.log(JSON.stringify({id: d.id, ...d.data()})));

    // 2. Pricing
    const pc = await db.collection('pricing_config').doc('current').get();
    console.log('\n=== PRICING CONFIG ===');
    console.log(JSON.stringify(pc.data(), null, 2));

    // 3. System status
    const ss = await db.collection('system_status').doc('current').get();
    console.log('\n=== SYSTEM STATUS ===');
    console.log(JSON.stringify(ss.data(), null, 2));

    // 4. Sessions summary
    const allSessions = await db.collection('parking_sessions').get();
    let activeCount = 0, closedCount = 0, autoClosedCount = 0;
    let withTicket = 0, withCharge = 0;
    let moradorCount = 0, visitanteCount = 0;
    const paymentStatuses = {};

    allSessions.docs.forEach(d => {
      const data = d.data();
      if (data.status === 'active') activeCount++;
      if (data.status === 'closed') closedCount++;
      if (data.auto_closed) autoClosedCount++;
      if (data.ticket_id) withTicket++;
      if (data.amount_charged) withCharge++;
      if (data.vehicle_type === 'morador') moradorCount++;
      if (data.vehicle_type === 'visitante') visitanteCount++;
      paymentStatuses[data.payment_status] = (paymentStatuses[data.payment_status] || 0) + 1;
    });

    console.log('\n=== SESSION SUMMARY ===');
    console.log('total:', allSessions.size);
    console.log('active:', activeCount, '| closed:', closedCount, '| auto_closed:', autoClosedCount);
    console.log('morador:', moradorCount, '| visitante:', visitanteCount);
    console.log('with ticket_id:', withTicket, '| with amount_charged:', withCharge);
    console.log('payment_statuses:', JSON.stringify(paymentStatuses));

    // 5. One auto_closed sample
    const acSample = allSessions.docs.find(d => d.data().auto_closed);
    if (acSample) {
      console.log('\n=== AUTO-CLOSED SAMPLE ===');
      console.log(JSON.stringify({id: acSample.id, ...acSample.data()}, null, 2));
    }

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
