# Herescope Integration Guide

Complete guide for integrating the LightSwarm lighting system with Herescope Unreal Engine application.

---

## Quick Start (Test in 60 Seconds)

Run these 3 commands in Terminal to verify the API is working:

```bash
# 1. Check system is running
curl http://MIDDLEWARE_IP:3000/api/v1/health

# 2. Login (stops ambient animation)
curl -X POST http://MIDDLEWARE_IP:3000/api/v1/session/login \
  -H "Content-Type: application/json" \
  -d '{"agentId": "test-agent"}'

# 3. Light an apartment green (Available)
curl -X PUT http://MIDDLEWARE_IP:3000/api/v1/apartments/RPT-L09-01 \
  -H "Content-Type: application/json" \
  -d '{"state": "AVAILABLE"}'
```

Replace `MIDDLEWARE_IP` with:
- `localhost` if running on same machine
- `192.168.x.x` for local network (find with `ifconfig` or `ipconfig`)
- Your Railway/cloud URL for remote testing

---

## API Overview

### Base URL

```
http://{MIDDLEWARE_IP}:3000/api/v1
```

### Authentication

**None required.** The API is designed for internal network use only.

### Request Format

All requests use JSON:
```
Content-Type: application/json
```

### Response Format

All responses return JSON with this structure:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Core Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    HERESCOPE WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. Agent Login Screen    ──────►  POST /session/login     │
│      (Idle/Ambient)                 • Stops ambient lights   │
│                                     • Fades all lights down  │
│                                                              │
│   2. Browsing Apartments   ──────►  PUT /apartments/:id     │
│      (Show availability)            • state: AVAILABLE/SOLD  │
│                                     • Lights turn on         │
│                                                              │
│   3. Select Apartment      ──────►  PUT /apartments/:id     │
│      (Highlight selection)          • state: SELECTED       │
│                                     • Light turns white      │
│                                                              │
│   4. View Floorplate       ──────►  PUT /floorplates/:id    │
│      (Show whole floor)             • All floor lights on    │
│                                                              │
│   5. Agent Logout          ──────►  POST /session/logout    │
│      (Return to idle)               • Starts ambient loop    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## State Codes Reference

| State | Color | RGB Default | When to Use |
|-------|-------|-------------|-------------|
| `AVAILABLE` | Green | 0, 255, 0 | Unit is for sale |
| `SOLD` | Red | 255, 0, 0 | Unit is sold |
| `RESERVED` | Yellow | 255, 255, 0 | Unit is reserved/held |
| `UNAVAILABLE` | Orange | 180, 80, 0 | Unit not available |
| `SELECTED` | White | 255, 255, 255 | Currently selected by user |

---

## API Endpoints

### Session Management

#### Login (Agent Starts Session)

```http
POST /api/v1/session/login
```

**Request:**
```json
{
  "agentId": "agent-001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session started",
  "data": {
    "sessionActive": true,
    "agentId": "agent-001",
    "loginTime": "2024-02-24T10:30:00Z"
  }
}
```

**What happens:**
1. Ambient animation stops
2. All lights fade down from top floor to bottom (sequential cascade)
3. System ready for apartment lighting commands

#### Logout (Agent Ends Session)

```http
POST /api/v1/session/logout
```

**Response:**
```json
{
  "success": true,
  "message": "Session ended",
  "data": {
    "sessionActive": false,
    "ambientRunning": true
  }
}
```

**What happens:**
1. All apartment lights turn off
2. Ambient animation starts looping

---

### Lighting Single Apartment

```http
PUT /api/v1/apartments/{apartmentId}
```

**Request:**
```json
{
  "state": "AVAILABLE",
  "fadeTime": 500,
  "intensity": 200
}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `state` | string | Yes | - | AVAILABLE, SOLD, RESERVED, UNAVAILABLE, SELECTED |
| `fadeTime` | number | No | 500 | Fade duration in milliseconds |
| `intensity` | number | No | 255 | Brightness 0-255 |
| `rgb` | object | No | - | Custom color `{r: 255, g: 0, b: 0}` |

**Apartment ID Format:**
- Pattern: `RPT-L{floor}-{unit}` (e.g., `RPT-L09-01`)
- Or use the plot number directly

**Response:**
```json
{
  "success": true,
  "data": {
    "apartmentId": "RPT-L09-01",
    "state": "AVAILABLE",
    "lightsControlled": 2
  }
}
```

---

### Lighting Multiple Apartments

```http
PUT /api/v1/apartments/batch
```

**Request (same state for all):**
```json
{
  "apartmentIds": ["RPT-L09-01", "RPT-L09-02", "RPT-L10-01"],
  "state": "AVAILABLE",
  "fadeTime": 500
}
```

**Request (different states):**
```json
{
  "apartments": [
    {"id": "RPT-L09-01", "state": "AVAILABLE"},
    {"id": "RPT-L09-02", "state": "SOLD"},
    {"id": "RPT-L10-01", "state": "SELECTED"}
  ],
  "fadeTime": 500
}
```

---

### Lighting a Floorplate (Entire Floor)

```http
PUT /api/v1/floorplates/{floorplateId}
```

**Request:**
```json
{
  "state": "AVAILABLE",
  "fadeTime": 500
}
```

**Floorplate ID:** Usually `Level-{floor}` (e.g., `Level-9`)

---

### Lighting Multiple Floors

```http
PUT /api/v1/floors/batch
```

**Request:**
```json
{
  "floors": [9, 10, 11, 12],
  "state": "AVAILABLE",
  "fadeTime": 300
}
```

---

### Turn All Lights Off

```http
POST /api/v1/apartments/all/off
```

---

### Turn All Lights On

```http
POST /api/v1/apartments/all/on
```

**Request (optional):**
```json
{
  "intensity": 200
}
```

---

### Get System Status

```http
GET /api/v1/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "uptime": 3600,
    "serialConnected": true,
    "simulationMode": false,
    "sessionActive": true,
    "ambientRunning": false,
    "stats": {
      "totalApartments": 334,
      "totalFloors": 47
    }
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Continue |
| 400 | Bad Request | Check your JSON format |
| 404 | Not Found | Apartment/floorplate ID doesn't exist |
| 500 | Server Error | Retry after 1 second |
| 502 | Bad Gateway | Server not running or restarting |

### Retry Logic

Implement exponential backoff for 500/502 errors:

```cpp
int maxRetries = 3;
int retryDelay = 1000; // ms

for (int i = 0; i < maxRetries; i++) {
    Response = SendRequest();
    if (Response.StatusCode == 200) break;
    if (Response.StatusCode >= 500) {
        Sleep(retryDelay);
        retryDelay *= 2; // Double delay each retry
    }
}
```

---

## Unreal Engine C++ Example

### HTTP Request Helper

```cpp
// LightSwarmAPI.h
#pragma once

#include "CoreMinimal.h"
#include "Http.h"

DECLARE_DELEGATE_TwoParams(FOnLightSwarmResponse, bool, FString);

class MYPROJECT_API FLightSwarmAPI
{
public:
    FLightSwarmAPI();
    
    void SetBaseURL(const FString& URL);
    
    void Login(const FString& AgentId, FOnLightSwarmResponse OnComplete);
    void Logout(FOnLightSwarmResponse OnComplete);
    void LightApartment(const FString& ApartmentId, const FString& State, FOnLightSwarmResponse OnComplete);
    void LightFloorplate(const FString& FloorplateId, const FString& State, FOnLightSwarmResponse OnComplete);
    void AllOff(FOnLightSwarmResponse OnComplete);
    
private:
    FString BaseURL;
    
    void SendRequest(const FString& Endpoint, const FString& Verb, const FString& Content, FOnLightSwarmResponse OnComplete);
};
```

```cpp
// LightSwarmAPI.cpp
#include "LightSwarmAPI.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"

FLightSwarmAPI::FLightSwarmAPI()
{
    BaseURL = TEXT("http://localhost:3000/api/v1");
}

void FLightSwarmAPI::SetBaseURL(const FString& URL)
{
    BaseURL = URL;
}

void FLightSwarmAPI::Login(const FString& AgentId, FOnLightSwarmResponse OnComplete)
{
    FString Content = FString::Printf(TEXT("{\"agentId\":\"%s\"}"), *AgentId);
    SendRequest(TEXT("/session/login"), TEXT("POST"), Content, OnComplete);
}

void FLightSwarmAPI::Logout(FOnLightSwarmResponse OnComplete)
{
    SendRequest(TEXT("/session/logout"), TEXT("POST"), TEXT("{}"), OnComplete);
}

void FLightSwarmAPI::LightApartment(const FString& ApartmentId, const FString& State, FOnLightSwarmResponse OnComplete)
{
    FString Endpoint = FString::Printf(TEXT("/apartments/%s"), *ApartmentId);
    FString Content = FString::Printf(TEXT("{\"state\":\"%s\",\"fadeTime\":500}"), *State);
    SendRequest(Endpoint, TEXT("PUT"), Content, OnComplete);
}

void FLightSwarmAPI::LightFloorplate(const FString& FloorplateId, const FString& State, FOnLightSwarmResponse OnComplete)
{
    FString Endpoint = FString::Printf(TEXT("/floorplates/%s"), *FloorplateId);
    FString Content = FString::Printf(TEXT("{\"state\":\"%s\",\"fadeTime\":500}"), *State);
    SendRequest(Endpoint, TEXT("PUT"), Content, OnComplete);
}

void FLightSwarmAPI::AllOff(FOnLightSwarmResponse OnComplete)
{
    SendRequest(TEXT("/apartments/all/off"), TEXT("POST"), TEXT("{}"), OnComplete);
}

void FLightSwarmAPI::SendRequest(const FString& Endpoint, const FString& Verb, const FString& Content, FOnLightSwarmResponse OnComplete)
{
    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    
    Request->SetURL(BaseURL + Endpoint);
    Request->SetVerb(Verb);
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Request->SetContentAsString(Content);
    
    Request->OnProcessRequestComplete().BindLambda([OnComplete](FHttpRequestPtr Request, FHttpResponsePtr Response, bool bSuccess)
    {
        if (bSuccess && Response.IsValid())
        {
            bool bApiSuccess = Response->GetResponseCode() == 200;
            OnComplete.ExecuteIfBound(bApiSuccess, Response->GetContentAsString());
        }
        else
        {
            OnComplete.ExecuteIfBound(false, TEXT("Request failed"));
        }
    });
    
    Request->ProcessRequest();
}
```

### Usage in Blueprint-Callable Actor

```cpp
// LightSwarmController.h
UCLASS(BlueprintType)
class MYPROJECT_API ALightSwarmController : public AActor
{
    GENERATED_BODY()
    
public:
    UFUNCTION(BlueprintCallable, Category = "LightSwarm")
    void AgentLogin(const FString& AgentId);
    
    UFUNCTION(BlueprintCallable, Category = "LightSwarm")
    void AgentLogout();
    
    UFUNCTION(BlueprintCallable, Category = "LightSwarm")
    void ShowApartmentAvailability(const FString& ApartmentId, bool bAvailable);
    
    UFUNCTION(BlueprintCallable, Category = "LightSwarm")
    void SelectApartment(const FString& ApartmentId);
    
    UFUNCTION(BlueprintCallable, Category = "LightSwarm")
    void ShowFloorAvailability(const FString& FloorplateId);
    
private:
    FLightSwarmAPI API;
};
```

---

## Testing Your Integration

### 1. Verify Connection

```bash
curl http://MIDDLEWARE_IP:3000/api/v1/health
# Expected: {"success":true,"status":"ok"}
```

### 2. Test Login/Logout Cycle

```bash
# Login
curl -X POST http://MIDDLEWARE_IP:3000/api/v1/session/login \
  -H "Content-Type: application/json" \
  -d '{"agentId": "herescope-test"}'

# Check status
curl http://MIDDLEWARE_IP:3000/api/v1/session/status

# Logout
curl -X POST http://MIDDLEWARE_IP:3000/api/v1/session/logout
```

### 3. Test Apartment Lighting

```bash
# Light one apartment
curl -X PUT http://MIDDLEWARE_IP:3000/api/v1/apartments/RPT-L09-01 \
  -H "Content-Type: application/json" \
  -d '{"state": "SELECTED"}'

# Light multiple
curl -X PUT http://MIDDLEWARE_IP:3000/api/v1/apartments/batch \
  -H "Content-Type: application/json" \
  -d '{"apartmentIds": ["RPT-L09-01", "RPT-L09-02"], "state": "AVAILABLE"}'

# All off
curl -X POST http://MIDDLEWARE_IP:3000/api/v1/apartments/all/off
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection refused | Check middleware is running, check IP/port |
| 404 on apartment | Verify apartment ID exists (check dashboard) |
| Lights don't change | Check simulation mode in dashboard, verify hardware |
| Slow response | Normal fade time is 500ms, reduce if needed |
| Ambient won't stop | Call `/session/login` to stop ambient animation |

---

## Network Configuration

For Herescope to reach the middleware across the network:

1. **Find middleware IP:** Run `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
2. **Configure firewall:** Allow incoming connections on port 3000
3. **Static IP recommended:** Set a static IP on the middleware machine

### Mac Firewall

```bash
# Allow Node.js through firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

### Test from Herescope machine

```bash
ping MIDDLEWARE_IP
curl http://MIDDLEWARE_IP:3000/api/v1/health
```
