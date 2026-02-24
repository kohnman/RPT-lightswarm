# LightSwarm Testing Checklist

**Project:** River Park Towers L18  
**Date:** _______________  
**Tester:** _______________

Print this checklist and work through each section. Mark each step as you complete it.

---

## Section 1: Pre-Flight Checks

Complete these before any other testing.

| # | Check | Pass | Fail | Notes |
|---|-------|------|------|-------|
| 1.1 | Middleware server is running | ☐ | ☐ | Terminal shows "Middleware initialized successfully!" |
| 1.2 | Dashboard opens in browser | ☐ | ☐ | Go to http://localhost:3000 |
| 1.3 | Status shows "Connected" (green) | ☐ | ☐ | Top-right header area |
| 1.4 | NOT in Simulation mode (or intentionally is) | ☐ | ☐ | Check badge in header |
| 1.5 | Serial port configured correctly | ☐ | ☐ | Settings → COM Port |
| 1.6 | Apartment data is loaded | ☐ | ☐ | Dashboard shows apartment count > 0 |

**If any FAIL:** Stop and resolve before continuing. See Troubleshooting section.

---

## Section 2: Basic Communication Test

Verify the system can send commands to lights.

### 2.1 Broadcast ON Test

| Step | Action | Expected Result | ✓ |
|------|--------|-----------------|---|
| 1 | Go to **Test Console** tab | Tab opens | ☐ |
| 2 | Find **Broadcast Commands** section | Section visible | ☐ |
| 3 | Click **All ON** button | Button responds | ☐ |
| 4 | Observe model | ALL lights turn ON (white) | ☐ |

### 2.2 Broadcast OFF Test

| Step | Action | Expected Result | ✓ |
|------|--------|-----------------|---|
| 1 | Click **All OFF** button | Button responds | ☐ |
| 2 | Observe model | ALL lights turn OFF | ☐ |

### 2.3 Single Address Test

| Step | Action | Expected Result | ✓ |
|------|--------|-----------------|---|
| 1 | In Test Console, enter Address: `1` | Field accepts input | ☐ |
| 2 | Select command: **Set RGB** | Dropdown shows RGB option | ☐ |
| 3 | Set Red: `255`, Green: `0`, Blue: `0` | Fields accept values | ☐ |
| 4 | Click **Send Command** | Packet hex appears below | ☐ |
| 5 | Observe model | Light at address 1 turns RED | ☐ |
| 6 | Click **All OFF** | Light turns off | ☐ |

**Result:** ☐ PASS / ☐ FAIL

---

## Section 3: State Colors Test

Verify each state displays the correct color.

**Setup:** Note one working light address: _______

| State | Command | Expected Color | Physical Match | ✓ |
|-------|---------|----------------|----------------|---|
| AVAILABLE | Set state via API | GREEN | | ☐ |
| SOLD | Set state via API | RED | | ☐ |
| RESERVED | Set state via API | YELLOW | | ☐ |
| UNAVAILABLE | Set state via API | ORANGE/BROWN | | ☐ |
| SELECTED | Set state via API | WHITE | | ☐ |

**Test commands (run in terminal):**

```bash
# Replace APARTMENT_ID with a real apartment ID
curl -X PUT http://localhost:3000/api/v1/apartments/APARTMENT_ID \
  -H "Content-Type: application/json" \
  -d '{"state": "AVAILABLE"}'
```

**Result:** ☐ PASS / ☐ FAIL

---

## Section 4: Individual Apartment Tests

Test 5 apartments from different floors.

| Apartment ID | Floor | Light IDs | Test Button Works | Correct Light | ✓ |
|--------------|-------|-----------|-------------------|---------------|---|
| | | | ☐ | ☐ | ☐ |
| | | | ☐ | ☐ | ☐ |
| | | | ☐ | ☐ | ☐ |
| | | | ☐ | ☐ | ☐ |
| | | | ☐ | ☐ | ☐ |

**Procedure for each:**
1. Go to **Mapping Editor** tab
2. Find the apartment row
3. Click **Test** button
4. Verify correct physical light turns WHITE for 3 seconds
5. Mark PASS if correct light, FAIL if wrong light or no response

**Result:** ☐ PASS / ☐ FAIL

---

## Section 5: Floorplate Tests

Test lighting entire floors.

| Floor | Floorplate ID | # Apartments | All Lights On | All Correct | ✓ |
|-------|---------------|--------------|---------------|-------------|---|
| 9 | Level-9 | | ☐ | ☐ | ☐ |
| 15 | Level-15 | | ☐ | ☐ | ☐ |
| 25 | Level-25 | | ☐ | ☐ | ☐ |
| 40 | Level-40 | | ☐ | ☐ | ☐ |
| 50 | Level-50 | | ☐ | ☐ | ☐ |

**Test command:**

```bash
curl -X PUT http://localhost:3000/api/v1/floorplates/Level-9 \
  -H "Content-Type: application/json" \
  -d '{"state": "AVAILABLE"}'
```

**After each test:** Run `curl -X POST http://localhost:3000/api/v1/apartments/all/off`

**Result:** ☐ PASS / ☐ FAIL

---

## Section 6: Session Flow Test

Test the login/logout workflow that Herescope will use.

### 6.1 Login Test

| Step | Action | Expected Result | ✓ |
|------|--------|-----------------|---|
| 1 | Ensure ambient animation is running | Lights are animating (if enabled) | ☐ |
| 2 | Run login command (below) | Command succeeds | ☐ |
| 3 | Observe model | Ambient stops | ☐ |
| 4 | Observe model | Lights fade down top-to-bottom | ☐ |
| 5 | Check dashboard | Session shows "Active" | ☐ |

```bash
curl -X POST http://localhost:3000/api/v1/session/login \
  -H "Content-Type: application/json" \
  -d '{"agentId": "test-checklist"}'
```

### 6.2 Light During Session

| Step | Action | Expected Result | ✓ |
|------|--------|-----------------|---|
| 1 | Light an apartment AVAILABLE | Light turns GREEN | ☐ |
| 2 | Light same apartment SELECTED | Light turns WHITE | ☐ |
| 3 | Light another apartment SOLD | Second light turns RED | ☐ |

### 6.3 Logout Test

| Step | Action | Expected Result | ✓ |
|------|--------|-----------------|---|
| 1 | Run logout command (below) | Command succeeds | ☐ |
| 2 | Observe model | Apartment lights turn off | ☐ |
| 3 | Observe model | Ambient animation starts (if enabled) | ☐ |
| 4 | Check dashboard | Session shows "Inactive" | ☐ |

```bash
curl -X POST http://localhost:3000/api/v1/session/logout
```

**Result:** ☐ PASS / ☐ FAIL

---

## Section 7: Batch Operations Test

Test multiple apartments at once.

### 7.1 Batch Light Test

```bash
curl -X PUT http://localhost:3000/api/v1/apartments/batch \
  -H "Content-Type: application/json" \
  -d '{
    "apartments": [
      {"id": "APARTMENT_1", "state": "AVAILABLE"},
      {"id": "APARTMENT_2", "state": "SOLD"},
      {"id": "APARTMENT_3", "state": "SELECTED"}
    ]
  }'
```

| Check | Expected | ✓ |
|-------|----------|---|
| Apartment 1 | GREEN | ☐ |
| Apartment 2 | RED | ☐ |
| Apartment 3 | WHITE | ☐ |
| All changed simultaneously | Within 1 second | ☐ |

### 7.2 Multi-Floor Test

```bash
curl -X PUT http://localhost:3000/api/v1/floors/batch \
  -H "Content-Type: application/json" \
  -d '{"floors": [10, 11, 12], "state": "AVAILABLE"}'
```

| Check | Expected | ✓ |
|-------|----------|---|
| Floor 10 | All lights GREEN | ☐ |
| Floor 11 | All lights GREEN | ☐ |
| Floor 12 | All lights GREEN | ☐ |

**Cleanup:** `curl -X POST http://localhost:3000/api/v1/apartments/all/off`

**Result:** ☐ PASS / ☐ FAIL

---

## Section 8: Edge Cases

### 8.1 Invalid Requests

| Test | Command | Expected Response | ✓ |
|------|---------|-------------------|---|
| Invalid apartment ID | `PUT /apartments/FAKE-ID` | 404 error | ☐ |
| Invalid state | `PUT /apartments/REAL-ID {"state":"WRONG"}` | 400 error | ☐ |
| Missing body | `PUT /apartments/REAL-ID` (no body) | 400 error | ☐ |

### 8.2 Rapid Commands

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 1 | Send 10 commands in quick succession | All execute | ☐ |
| 2 | Check dashboard log | All logged | ☐ |
| 3 | No errors in terminal | Clean output | ☐ |

**Result:** ☐ PASS / ☐ FAIL

---

## Section 9: Full System Test

Complete end-to-end test simulating real usage.

| # | Scenario | Actions | Pass | Fail |
|---|----------|---------|------|------|
| 9.1 | System startup | Start middleware, verify dashboard | ☐ | ☐ |
| 9.2 | Agent login | Login, verify ambient stops | ☐ | ☐ |
| 9.3 | Browse floor 10 | Light floorplate 10 available | ☐ | ☐ |
| 9.4 | Select apartment | Change one to SELECTED | ☐ | ☐ |
| 9.5 | View sold units | Change some to SOLD | ☐ | ☐ |
| 9.6 | Clear selection | All off | ☐ | ☐ |
| 9.7 | Browse floor 20 | Light floorplate 20 available | ☐ | ☐ |
| 9.8 | Agent logout | Logout, verify ambient starts | ☐ | ☐ |
| 9.9 | System stable | No errors for 5 minutes | ☐ | ☐ |

**Result:** ☐ PASS / ☐ FAIL

---

## Test Summary

| Section | Result |
|---------|--------|
| 1. Pre-Flight Checks | ☐ PASS / ☐ FAIL |
| 2. Basic Communication | ☐ PASS / ☐ FAIL |
| 3. State Colors | ☐ PASS / ☐ FAIL |
| 4. Individual Apartments | ☐ PASS / ☐ FAIL |
| 5. Floorplates | ☐ PASS / ☐ FAIL |
| 6. Session Flow | ☐ PASS / ☐ FAIL |
| 7. Batch Operations | ☐ PASS / ☐ FAIL |
| 8. Edge Cases | ☐ PASS / ☐ FAIL |
| 9. Full System | ☐ PASS / ☐ FAIL |

**Overall Result:** ☐ ALL PASS / ☐ ISSUES FOUND

---

## Issues Log

| Issue # | Section | Description | Severity | Resolved |
|---------|---------|-------------|----------|----------|
| 1 | | | ☐ High / ☐ Med / ☐ Low | ☐ |
| 2 | | | ☐ High / ☐ Med / ☐ Low | ☐ |
| 3 | | | ☐ High / ☐ Med / ☐ Low | ☐ |
| 4 | | | ☐ High / ☐ Med / ☐ Low | ☐ |
| 5 | | | ☐ High / ☐ Med / ☐ Low | ☐ |

---

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| "Connected" not showing | Check USB cable, restart middleware |
| Light doesn't respond | Verify Light ID in Mapping Editor, test with direct address |
| Wrong light responds | Light ID mapping is incorrect, update in Mapping Editor |
| Commands timeout | Check network, restart middleware |
| Dashboard blank | Clear browser cache, check terminal for errors |
| Ambient won't stop | Call `/session/login` endpoint |
| Ambient won't start | Call `/session/logout` endpoint, check Settings |

---

## Sign-Off

**Tester Name:** _________________________

**Tester Signature:** _________________________

**Date:** _________________________

**Supervisor (if required):** _________________________
