#!/usr/bin/env bash
# test_elysia_api.sh
# A script to test various endpoints of the Elysia API

BASE_URL="http://localhost:3000"

echo "Testing Elysia API endpoints..."

# 1. Root endpoint GET /
echo -e "\n1) GET /"
curl -sS "$BASE_URL/" -H "Accept: application/json" | jq .

# 2. GET /status
echo -e "\n2) GET /status"
curl -sS "$BASE_URL/status" -H "Accept: application/json" | jq .

# 3. GET /version
echo -e "\n3) GET /version"
curl -sS "$BASE_URL/version" -H "Accept: application/json" | jq .

# 4. GET /info
echo -e "\n4) GET /info"
curl -sS "$BASE_URL/info" -H "Accept: application/json" | jq .

# 5. GET /health
echo -e "\n5) GET /health"
curl -sS "$BASE_URL/health" -H "Accept: application/json" | jq .

# 6. POST /api/reverse-image (replace with your actual image path)
echo -e "\n6) POST /api/reverse-image"
curl -sS -F "file=@./test-image.jpg" "$BASE_URL/api/reverse-image" | jq .

# 7. GET /api/gnews/search (example query parameters)
echo -e "\n7) GET /api/gnews/search"
curl -sS -G "$BASE_URL/api/gnews/search" \
  --data-urlencode "q=latest tech" \
  --data-urlencode "lang=en" \
  --data-urlencode "country=us" \
  -H "Accept: application/json" | jq .

# 8. GET /api/gnews/top-headlines (example categories)
echo -e "\n8) GET /api/gnews/top-headlines"
curl -sS -G "$BASE_URL/api/gnews/top-headlines" \
  --data-urlencode "country=us" \
  --data-urlencode "category=technology" \
  -H "Accept: application/json" | jq .

# 9. GET /api/google/cse (Google Custom Search example)
echo -e "\n9) GET /api/google/cse"
curl -sS -G "$BASE_URL/api/google/cse" \
  --data-urlencode "q=typescript tutorials" \
  --data-urlencode "num=5" \
  -H "Accept: application/json" | jq .

# 10. GET /api/youtube/search (YouTube search example)
echo -e "\n10) GET /api/youtube/search"
curl -sS -G "$BASE_URL/api/youtube/search" \
  --data-urlencode "q=OpenAI updates" \
  --data-urlencode "maxResults=5" \
  -H "Accept: application/json" | jq .

echo -e "\nAll requests completed."
