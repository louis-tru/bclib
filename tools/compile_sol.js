#!/usr/bin/env node
/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

// compile solidity

require('./_');

var somes = require('somes').default;
var syscall = require('somes/syscall');
var path = require('path');
var fs2 = require('somes/fs2');

var src = path.resolve(`${__dirname}/../src/solidity`);
var out = path.resolve(`${__dirname}/../out/solidity`);

fs2.removerSync(out);

var cmd = `\
	${process.execPath} \
	${__dirname}/../node_modules/.bin/solcjs --bin --abi \
	--base-path=. ./*.sol --output-dir=${out} --optimize \
`;

var r = syscall.execSync(`cd ${src} && ${cmd}`);

console.log('stdout:', r.stdout);
console.error('stderr:', r.stderr);

somes.assert(r.code === 0);

var abis = fs2.readdirSync(out).filter(e=>path.extname(e)=='.abi');
var bins = fs2.readdirSync(out).filter(e=>path.extname(e)=='.bin');

var artifacts = path.resolve(`${src}/../artifacts`);

fs2.mkdirpSync(artifacts); // mkdir -p

abis.forEach(function(abi_path, j) {
	var contractName = abi_path.substring(abi_path.lastIndexOf('_') + 1, abi_path.length - 4);
	var abi = fs2.readFileSync(`${out}/${abi_path}`, 'utf-8');
	var bytecode = fs2.readFileSync(`${out}/${bins[j]}`, 'utf-8');

	var json = {
		contractName,
		abi: JSON.parse(abi),
		bytecode: '0x' + bytecode,
	};

	fs2.writeFileSync(`${artifacts}/${contractName}.json`, JSON.stringify(json, null, 2));
});

console.log('solidity compile ok');