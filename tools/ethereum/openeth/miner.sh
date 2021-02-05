#!/bin/sh

export LC_ALL="C" # fix centos startup error

set -e

base=$(dirname $0)
cd $base

ethminer=ethminer

# $ethminer \
# --cpu \
# --cp-devices=0 \
# --cp-devices=1 \
# --cp-devices=3 \
# -P stratum://127.0.0.1:8545

$ethminer \
--cpu \
--cp-devices=0 \
--cp-devices=1 \
--cp-devices=3 \
-P http://127.0.0.1:7777