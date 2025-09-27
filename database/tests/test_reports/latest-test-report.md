# Los Alamos Chess Database Test Report

**Generated:** 2025-09-27 at 08:56:08 UTC
**Test Suite:** Database Unit Tests
**Maintainer:** Arno Meyer (Database & Persistence)

## Test Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | 15 |
| **Passed** | 9 |
| **Failed** | 6 |
| **Success Rate** | 60.0% |
| **Duration** | 2938ms |
| **Coverage** | 55% |

### Overall Status: ❌ FAIL

⚠️ **6 test(s) failed.** Review required before integration.

## Test Details

### ✅ DB-01
**Status:** PASS
**Message:** User created with properly hashed password

### ✅ DB-02
**Status:** PASS
**Message:** Duplicate email correctly rejected with constraint violation

### ✅ DB-03
**Status:** PASS
**Message:** Game created with correct initial state

### ⚠️ DB-04
**Status:** ERROR
**Message:** relation "moves" does not exist

### ✅ DB-05
**Status:** PASS
**Message:** Optimistic locking working correctly

### ⚠️ DB-06
**Status:** ERROR
**Message:** relation "moves" does not exist

### ✅ DB-07
**Status:** PASS
**Message:** Audit log created with correct metadata

### ❌ DB-08
**Status:** FAIL
**Message:** Unexpected error for rating 3001: current transaction is aborted, commands ignored until end of transaction block

### ⚠️ DB-09
**Status:** ERROR
**Message:** relation "moves" does not exist

### ✅ DB-10
**Status:** PASS
**Message:** Performance test passed: 100 users created in 219ms

### ✅ DB-11
**Status:** PASS
**Message:** Foreign key constraint correctly prevented game creation with non-existent players

### ✅ DB-12
**Status:** PASS
**Message:** Index performance test passed: Email lookup completed in 0ms

### ⚠️ DB-13
**Status:** ERROR
**Message:** relation "tournaments" does not exist

### ⚠️ DB-14
**Status:** ERROR
**Message:** column "requester_id" of relation "friendships" does not exist

### ✅ DB-15
**Status:** PASS
**Message:** Data consistency maintained under concurrent load

## ❌ Failed Tests

### DB-04
**Error:** Test execution error: relation "moves" does not exist
**Stack Trace:**
```
error: relation "moves" does not exist
    at C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\node_modules\pg\lib\client.js:545:17
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Object.testFunction (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\db-core-tests.js:246:32)
    at async TestFramework.runSingleTest (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:119:30)
    at async TestFramework.runAllTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:90:13)
    at async runDatabaseTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:138:25)
    at async main (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:297:22)
```

### DB-06
**Error:** Test execution error: relation "moves" does not exist
**Stack Trace:**
```
error: relation "moves" does not exist
    at C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\node_modules\pg\lib\client.js:545:17
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Object.testFunction (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\db-core-tests.js:390:17)
    at async TestFramework.runSingleTest (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:119:30)
    at async TestFramework.runAllTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:90:13)
    at async runDatabaseTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:138:25)
    at async main (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:297:22)
```

### DB-08
**Error:** Unexpected error for rating 3001: current transaction is aborted, commands ignored until end of transaction block

### DB-09
**Error:** Test execution error: relation "moves" does not exist
**Stack Trace:**
```
error: relation "moves" does not exist
    at C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\node_modules\pg\lib\client.js:545:17
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Object.testFunction (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\db-advanced-tests.js:133:32)
    at async TestFramework.runSingleTest (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:119:30)
    at async TestFramework.runAllTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:90:13)
    at async runDatabaseTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:138:25)
    at async main (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:297:22)
```

### DB-13
**Error:** Test execution error: relation "tournaments" does not exist
**Stack Trace:**
```
error: relation "tournaments" does not exist
    at C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\node_modules\pg\lib\client.js:545:17
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Object.testFunction (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\db-advanced-tests.js:313:38)
    at async TestFramework.runSingleTest (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:119:30)
    at async TestFramework.runAllTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:90:13)
    at async runDatabaseTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:138:25)
    at async main (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:297:22)
```

### DB-14
**Error:** Test execution error: column "requester_id" of relation "friendships" does not exist
**Stack Trace:**
```
error: column "requester_id" of relation "friendships" does not exist
    at C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\node_modules\pg\lib\client.js:545:17
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Object.testFunction (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\db-advanced-tests.js:394:41)
    at async TestFramework.runSingleTest (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:119:30)
    at async TestFramework.runAllTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\test-framework.js:90:13)
    at async runDatabaseTests (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:138:25)
    at async main (C:\Users\arnom\OneDrive\Academic\Y3S2\EPE321\2 - Project\Git\losalamoschess\database\tests\run-tests.js:297:22)
```

## 📋 Recommendations

- ❌ Fix failing tests before integration
- 🔍 Review error messages and stack traces
- 🛠️ Check database schema and connections
- 🔄 Re-run tests after fixes

---
*Generated by Los Alamos Chess Database Test Suite*
*EPE321 Software Engineering - Group 14*
