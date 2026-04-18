#!/bin/bash
set -e

echo "=== Running migrations on live ==="
ssh boardgam1@198.38.86.14 "cd public_html && php artisan migrate --force"

echo ""
echo "Done!"

say -v Samantha "Live migrations complete."
