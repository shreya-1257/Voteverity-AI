const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🧪 Starting VoteVerity AI End-to-End Test Suite...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await test('Server health endpoint returns 200 and operational status', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
  });

  // 2. Student Registration
  const testStudentRoll = `21TEST${Date.now().toString().slice(-4)}`;
  const testStudentPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  await test('Student registration succeeds with pending approval and no OTP', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rahul Sharma',
        roll_number: testStudentRoll,
        email: `rahul.${Date.now()}@college.edu`,
        phone: testStudentPhone,
        password: 'Password@123',
        department: 'Information Technology',
        student_class: 'TY-IT',
        gender: 'M'
      })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.student.approval_status, 'pending');
    assert.strictEqual(res.data.student.has_voted, false);
    assert.strictEqual(res.data.student.password_hash, undefined); // password hash not leaked
  });

  // 3. Student Login
  let studentToken = null;
  await test('Registered student can log in and receives JWT token', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        role: 'student',
        identifier: testStudentRoll,
        password: 'Password@123'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.token);
    studentToken = res.data.token;
  });

  // 4. Student Profile View & Edit
  await test('Student can view and edit their own profile while protecting restricted fields', async () => {
    const getRes = await request('/api/students/profile', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.data.profile.roll_number, testStudentRoll);

    // Update permitted fields
    const updatedPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const updateRes = await request('/api/students/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        name: 'Rahul V. Sharma',
        phone: updatedPhone,
        department: 'Artificial Intelligence & DS',
        student_class: 'TY-AIDS-A',
        // Attempting to modify restricted fields:
        roll_number: 'HACKED_ROLL',
        approval_status: 'approved',
        has_voted: true,
        role: 'admin'
      })
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.profile.name, 'Rahul V. Sharma');
    assert.strictEqual(updateRes.data.profile.department, 'Artificial Intelligence & DS');
    assert.strictEqual(updateRes.data.profile.student_class, 'TY-AIDS-A');
    // Verify restricted fields remain intact:
    assert.strictEqual(updateRes.data.profile.roll_number, testStudentRoll);
    assert.strictEqual(updateRes.data.profile.approval_status, 'pending');
    assert.strictEqual(updateRes.data.profile.role, 'student');
    assert.strictEqual(updateRes.data.profile.has_voted, false);
  });

  // 5. Unapproved student cannot vote
  await test('Pending student is rejected from voting with 403', async () => {
    const res = await request('/api/vote', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selections: { president: '1', vpBoy: '3', vpGirl: '5' }
      })
    });
    assert.strictEqual(res.status, 403);
  });

  // 6. Admin Login
  let adminToken = null;
  await test('Admin logs in successfully with demo credentials', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        role: 'admin',
        identifier: 'admin',
        password: 'Admin@123'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'admin');
    assert.ok(res.data.token);
    adminToken = res.data.token;
  });

  // 7. Admin Student Search & Approval
  await test('Admin can search, view, and approve the new student', async () => {
    const searchRes = await request(`/api/admin/students?search=${testStudentRoll}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchRes.data.students.length >= 1);

    const approveRes = await request(`/api/admin/students/${testStudentRoll}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'approved' })
    });
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.data.student.approval_status, 'approved');
  });

  // 8. Admin Bulk Status Update
  await test('Admin bulk update approves multiple students atomically', async () => {
    const bulkRes = await request('/api/admin/students/bulk-status', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        roll_numbers: ['21CS001', '21CS002', '21EC014'],
        status: 'approved'
      })
    });
    assert.strictEqual(bulkRes.status, 200);
    assert.strictEqual(bulkRes.data.success, true);
    assert.ok(bulkRes.data.count >= 1);
  });

  // 9. Candidates & Election Status
  let candidates = [];
  await test('Candidate list and election status are accessible', async () => {
    const cRes = await request('/api/candidates');
    assert.strictEqual(cRes.status, 200);
    assert.ok(cRes.data.candidates.length > 0);
    candidates = cRes.data.candidates;

    const eRes = await request('/api/election/status');
    assert.strictEqual(eRes.status, 200);
    assert.ok(eRes.data.election.id);
  });

  // 10. Open Election
  await test('Admin sets election status to open', async () => {
    const res = await request('/api/election/status', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'open' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.election.status, 'open');
  });

  // 11. Approved Student Casts Vote
  let receiptCode = null;
  await test('Approved student casts anonymous secret ballot and receives cryptographic receipt', async () => {
    // Refresh student token
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'student', identifier: testStudentRoll, password: 'Password@123' })
    });
    studentToken = loginRes.data.token;

    const presCand = candidates.find(c => c.post_key === 'president');
    const vpBoyCand = candidates.find(c => c.post_key === 'vpBoy');
    const vpGirlCand = candidates.find(c => c.post_key === 'vpGirl');

    const voteRes = await request('/api/vote', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selections: {
          president: presCand ? presCand.id : 'nota',
          vpBoy: vpBoyCand ? vpBoyCand.id : 'nota',
          vpGirl: vpGirlCand ? vpGirlCand.id : 'nota'
        }
      })
    });
    assert.strictEqual(voteRes.status, 201);
    assert.strictEqual(voteRes.data.success, true);
    assert.ok(voteRes.data.receipt);
    receiptCode = voteRes.data.receipt;
  });

  // 12. Duplicate Vote Prevention
  await test('Prevent duplicate voting: Second vote attempt returns 403', async () => {
    const dupRes = await request('/api/vote', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selections: { president: 'nota', vpBoy: 'nota', vpGirl: 'nota' }
      })
    });
    assert.strictEqual(dupRes.status, 403);
    assert.ok(dupRes.data.message.includes('already voted'));
  });

  // 13. Receipt Verification
  await test('Voter can verify their receipt in the ballot chain', async () => {
    const vRes = await request(`/api/vote/verify/${receiptCode}`);
    assert.strictEqual(vRes.status, 200);
    assert.strictEqual(vRes.data.verified, true);
  });

  // 14. Hash Chain Integrity Verification
  await test('Cryptographic hash chain is verified with unbroken genesis link', async () => {
    const chainRes = await request('/api/election/verify-chain', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(chainRes.status, 200);
    assert.strictEqual(chainRes.data.chainValid, true);
    assert.ok(chainRes.data.totalBallots >= 1);
  });

  // 15. Results Sealed While Open, Published When Closed
  await test('Results are sealed (403) while election is open', async () => {
    const res = await request('/api/election/results');
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.published, false);
  });

  await test('Results are published when election status is closed', async () => {
    // Close election
    await request('/api/election/status', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'closed' })
    });

    const res = await request('/api/election/results');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.published, true);
    assert.ok(res.data.results.length >= 3);
    assert.ok(res.data.totalVotes >= 1);

    // Re-open election for active testing
    await request('/api/election/status', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'open' })
    });
  });

  // 16. AI Anomaly & Analytics
  await test('AI Module detects voting metrics and evaluates fraud/anomaly risk', async () => {
    const anomRes = await request('/api/ai/anomalies', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(anomRes.status, 200);
    assert.ok(anomRes.data.integrityScore !== undefined);
    assert.ok(anomRes.data.riskLevel);

    const statRes = await request('/api/ai/analytics', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(statRes.status, 200);
    assert.ok(statRes.data.analytics.departmentTurnout);
  });

  // 17. Audit Logs
  await test('Audit logs record administrative actions', async () => {
    const logRes = await request('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(logRes.status, 200);
    assert.ok(logRes.data.logs.length >= 1);
  });

  console.log(`\n=========================================`);
  console.log(`🏁 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`=========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
