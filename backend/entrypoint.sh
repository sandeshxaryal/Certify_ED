#!/bin/bash

# Wait for Ganache
/app/wait-for-it.sh ganache:8545 -t 60

# Execute migrations
truffle compile --config truffle-config.cjs
truffle migrate --reset --network development --config truffle-config.cjs

# Keep container running
tail -f /dev/null