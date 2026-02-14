// Native fetch in Node 18+

const BASE = 'http://localhost:5000/api';

async function test() {
    try {
        console.log("Testing Settings...");
        await fetch(`${BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'milk_price', value: '50' })
        });

        console.log("Testing Create Customer...");
        const custRes = await fetch(`${BASE}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test User', mobile: '1234567890', default_quantity: 1 })
        });
        const cust = await custRes.json();
        console.log("Created Customer:", cust);

        console.log("Testing Override...");
        const today = new Date().toISOString().split('T')[0];
        await fetch(`${BASE}/overrides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: cust.id, date: today, quantity: 2 })
        });

        console.log("Testing Deliveries...");
        const delRes = await fetch(`${BASE}/deliveries?date=${today}`);
        const deliveries = await delRes.json();
        const d = deliveries.find(x => x.id === cust.id);
        if (d && d.quantity === 2 && d.is_override === 1) {
            console.log("Delivery Override Verified: YES");
        } else {
            console.error("Delivery Override Failed", d);
        }

        console.log("Testing Billing...");
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        const billRes = await fetch(`${BASE}/bill/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month, year })
        });
        const bills = await billRes.json();
        console.log("Bills:", bills);

    } catch (e) {
        console.error(e);
    }
}

test();
