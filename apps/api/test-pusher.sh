#!/bin/bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8787/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"password123"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
echo "Token Acquired"
QUEUE_ID=$(curl -s -X POST http://127.0.0.1:8787/api/queue -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"branchId":"branch-scbd","customerName":"Psh Test","customerPhone":"999-'"$RANDOM"'","serviceIds":["svc-haircut"],"startTime":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","estimatedDuration":30,"source":"WALK_IN"}' | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Queue ID: $QUEUE_ID"
curl -is -X PATCH "http://127.0.0.1:8787/api/queue/$QUEUE_ID/status" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"AT_CHECKOUT"}'
