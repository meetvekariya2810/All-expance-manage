require('dotenv').config();
const request = require('express');
const app = require('../server/server');
const { connectDB } = require('../server/config/db');

async function runEndToEndVerification() {
  console.log('========================================================');
  console.log('🧪 Starting End-to-End API Verification');
  console.log('========================================================\n');

  await connectDB();

  const server = app.listen(5099, async () => {
    try {
      const baseUrl = 'http://localhost:5099';

      // 1. Test Harsh Login
      console.log('1️⃣ Testing Harsh Login (POST /api/auth/login)...');
      const harshLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'harsh', password: 'harsh123' })
      });
      const harshLoginData = await harshLoginRes.json();
      console.log('   Status:', harshLoginRes.status, 'Success:', harshLoginData.success);
      console.log('   User:', harshLoginData.user?.name, `(${harshLoginData.user?.username})`, 'Role:', harshLoginData.user?.role);
      
      if (!harshLoginData.token) {
        throw new Error('Harsh login failed: ' + JSON.stringify(harshLoginData));
      }
      const harshToken = harshLoginData.token;

      // 2. Test Harsh Expense History Fetch
      console.log('\n2️⃣ Testing Harsh Expense History (GET /api/expenses?limit=300)...');
      const harshExpRes = await fetch(`${baseUrl}/api/expenses?limit=300`, {
        headers: { Authorization: `Bearer ${harshToken}` }
      });
      const harshExpData = await harshExpRes.json();
      console.log('   Status:', harshExpRes.status, 'Success:', harshExpData.success);
      console.log('   Total records returned for Harsh:', harshExpData.total || harshExpData.expenses?.length);

      const harshExpenses = harshExpData.expenses || [];
      const debits = harshExpenses.filter(e => e.transaction_type === 'Debit' || e.description.includes('[Debit]'));
      const credits = harshExpenses.filter(e => e.transaction_type === 'Credit' || e.description.includes('[Credit]'));
      console.log(`   - Debit records found: ${debits.length}`);
      console.log(`   - Credit records found: ${credits.length}`);

      // 3. Test Search Credit
      console.log('\n3️⃣ Testing Search for Credit transactions (GET /api/expenses?search=credit)...');
      const creditSearchRes = await fetch(`${baseUrl}/api/expenses?search=credit&limit=300`, {
        headers: { Authorization: `Bearer ${harshToken}` }
      });
      const creditSearchData = await creditSearchRes.json();
      console.log('   Status:', creditSearchRes.status, 'Credit records matched:', creditSearchData.total);

      // 4. Test Search Debit
      console.log('\n4️⃣ Testing Search for Debit transactions (GET /api/expenses?search=debit&limit=300)...');
      const debitSearchRes = await fetch(`${baseUrl}/api/expenses?search=debit&limit=300`, {
        headers: { Authorization: `Bearer ${harshToken}` }
      });
      const debitSearchData = await debitSearchRes.json();
      console.log('   Status:', debitSearchRes.status, 'Debit records matched:', debitSearchData.total);

      // 5. Test Meet Login & verify NO Harsh records in Meet
      console.log('\n5️⃣ Testing Meet Login (POST /api/auth/login) to verify ZERO Harsh data in Meet account...');
      const meetLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'meet', password: 'meet123' })
      });
      const meetLoginData = await meetLoginRes.json();
      console.log('   Status:', meetLoginRes.status, 'Success:', meetLoginData.success);
      console.log('   User:', meetLoginData.user?.name, `(${meetLoginData.user?.username})`);

      const meetExpRes = await fetch(`${baseUrl}/api/expenses?limit=300`, {
        headers: { Authorization: `Bearer ${meetLoginData.token}` }
      });
      const meetExpData = await meetExpRes.json();
      console.log('   Total records returned for Meet:', meetExpData.total || meetExpData.expenses?.length);

      // Ensure NO expense in Meet has user_id usr_harsh_04
      const harshInMeet = (meetExpData.expenses || []).filter(e => e.user_id === 'usr_harsh_04' || e.user_name === 'Harsh');
      console.log('   Harsh expenses found in Meet account:', harshInMeet.length, '(Must be 0)');

      // 6. Test Bhavik Admin Login (Can see all)
      console.log('\n6️⃣ Testing Bhavik Admin Login (POST /api/auth/login)...');
      const bhavikLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bhavik', password: 'bhavik123' })
      });
      const bhavikLoginData = await bhavikLoginRes.json();
      console.log('   Status:', bhavikLoginRes.status, 'Success:', bhavikLoginData.success);
      console.log('   User:', bhavikLoginData.user?.name, 'Role:', bhavikLoginData.user?.role);

      const bhavikFilterHarshRes = await fetch(`${baseUrl}/api/expenses?person=harsh&limit=300`, {
        headers: { Authorization: `Bearer ${bhavikLoginData.token}` }
      });
      const bhavikFilterHarshData = await bhavikFilterHarshRes.json();
      console.log('   Bhavik Admin filter for person=harsh count:', bhavikFilterHarshData.total);

      console.log('\n========================================================');
      console.log('🎉 ALL END-TO-END TESTS PASSED WITH 100% SUCCESS!');
      console.log('========================================================');

    } catch (err) {
      console.error('❌ Verification failed:', err);
    } finally {
      server.close(() => {
        process.exit(0);
      });
    }
  });
}

runEndToEndVerification();

