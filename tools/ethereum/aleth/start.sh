#!/bin/sh

set -e

base=$(dirname $0)
cd $base
cwd=`pwd`
run=aleth
mining_threads=$1

if [ "$2" == "" ]; then
	out=${cwd}/ethereum
else
	out=$2/ethereum
fi

mkdir -p $out

author=`cat ${cwd}/../author`
if [ -f  ${cwd}/../.author ]; then
	author=`cat ${cwd}/../.author`
fi

echo mining author $author

args="\
	--listen=5556 \
	--db-path=$out \
	--data-dir=$out \
	--address=$author \
	--rescue \
"
# --admin=123456 \

############################################################

bootnodes_str=`cat ${cwd}/../bootnodes`
bootnodes=
if [ -f "${cwd}/../.bootnodes" ]; then
	bootnodes_str=`cat ${cwd}/../.bootnodes`
fi
for value in ${bootnodes_str[@]}
do
	if [ "$bootnodes" == "" ]; then
		bootnodes="required:$value"
	else
		bootnodes="$bootnodes,required:$value"
	fi
done

chain=${cwd}/chain.json
[ "$3" == "test" ] && chain="ropsten"
# chain="ropsten"
# mainnet,ropsten,test

if [ -f "$chain" ]; then # Custom network
	args="$args --no-bootstrap --config=$chain "
elif [ "$chain" != "" ]; then
	args="$args --$chain "
	bootnodes=""
else
	args="$args --mainnet "
	bootnodes=""
fi

if [ "$bootnodes" != "" ]; then
	args="$args --peerset=$bootnodes "
fi

if [ -f ../.ip ]; then
	public_ip=`cat ../.ip`
	if [ "$public_ip" != "" ]; then
		args="$args --public-ip=$public_ip "
	fi
fi

if [ "$mining_threads" != "" ] && [ "$mining_threads" != "0" ]; then
	args="$args --mining=on --mining-threads=$mining_threads "
fi

# echo $args

$run $args
