#!/bin/sh

set -e

base=$(dirname $0)
cd $base
cwd=`pwd`
run=openethereum
out=${cwd}/ethereum
[ "$1" != "" ] && out=$1/ethereum
[ "$2" == "test" ] && test="test"
[ "$3" != "" ] && clear="clear"

# logging="engine=trace,client=trace,chain=trace,casper=trace,state=trace,evm=trace,\
# executive=trace,enact=trace,sync=trace,own_tx=trace,hardchain=trace,miner=trace,ethash=trace,verification=trace"

mkdir -p $out

# echo "" > ${out}/console.log

author=`cat ${cwd}/../author`
if [ -f  ${cwd}/../.author ]; then
	author=`cat ${cwd}/../.author`
fi

echo mining author $author

args="\
	--config=${cwd}/config.toml \
	--base-path=$out \
	--db-path=$out \
	--log-file=${out}/console.log \
	--ipc-path=${out}/rpc.ipc \
	--author=$author \
"

############################################################

if [ "$clear" != "" ]; then
	rm -rf $out/cache
	rm -rf $out/ccl
	rm -rf $out/console.log
	rm -rf $out/rpc.ipc
	rm -rf $out/ver.lock
fi

bootnodes_str=`cat ${cwd}/../bootnodes`
bootnodes=
if [ -f "${cwd}/../.bootnodes" ]; then
	bootnodes_str=`cat ${cwd}/../.bootnodes`
fi
for value in ${bootnodes_str[@]}
do
	if [ "$bootnodes" == "" ]; then
		bootnodes="$value"
	else
		bootnodes="$bootnodes,$value"
	fi
done

chain=${cwd}/chain.json
[ "$2" == "test" ] && chain="ropsten"
# chain="ropsten"
# ethereum, poacore, xdai, volta, ewc, musicoin, 
# ellaism, mix, callisto, morden, ropsten, kovan, rinkeby, 
# goerli, poasokol, testnet, or dev

if [ -f "$chain" ]; then # Custom network
	args="$args --no-discovery --chain=$chain "
elif [ "$chain" != "" ]; then
	args="$args --chain=$chain "
	bootnodes=""
else
	args="$args --chain=ethereum "
	bootnodes=""
fi

if [ "$bootnodes" != "" ]; then
	args="$args --bootnodes="$bootnodes" "
fi

if [ "$logging" != "" ]; then
	args="$args --logging=$logging --tracing=on "
fi

if [ -f "${cwd}/../.unlock" ]; then
	unlock_str=`cat ${cwd}/../.unlock`
	unlock=
	for value in ${unlock_str[@]}
	do
		if [ "$unlock" == "" ]; then
			unlock="$value"
		else
			unlock="$unlock,$value"
		fi
	done
	if [ "${unlock}" != "" ]; then
		args=" $args --unlock=${unlock} "
	fi
fi

if [ -f ../.password ]; then
	args=" $args --password=${cwd}/../.password "
fi

# echo $args

$run $args
