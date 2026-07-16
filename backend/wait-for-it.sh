#!/usr/bin/env bash
#   Use this script to test if a given TCP host/port are available
#   Usage:
#       ./wait-for-it.sh host:port [-t timeout] [-- command args]
#
#   Examples:
#       ./wait-for-it.sh ganache:8545 -- echo "Ganache is up"

WAITFORIT_cmdname=${0##*/}

if [ $# -lt 1 ]; then
    echo "Usage: $WAITFORIT_cmdname host:port [-t timeout] [-- command args]"
    exit 1
fi

HOSTPORT=($1)
HOST=${HOSTPORT%%:*}
PORT=${HOSTPORT#*:}
shift

TIMEOUT=15
while getopts ":t:" opt; do
  case $opt in
    t)
      TIMEOUT=$OPTARG
      ;;
    *)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
  esac
done
shift $((OPTIND-1))

echo "Waiting for $HOST:$PORT with timeout $TIMEOUT seconds..."

start_ts=$(date +%s)
while :
do
  if nc -z "$HOST" "$PORT"; then
    echo "$HOST:$PORT is available"
    break
  fi
  now_ts=$(date +%s)
  elapsed=$(($now_ts - $start_ts))
  if [ $elapsed -ge $TIMEOUT ]; then
    echo "Timeout after $TIMEOUT seconds waiting for $HOST:$PORT"
    exit 1
  fi
  sleep 1
done

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
