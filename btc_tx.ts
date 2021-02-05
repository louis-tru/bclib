/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import * as bitcoin from 'bitcoinjs-lib';
import {Transaction, SignerAsync} from 'bitcoinjs-lib';
import { payments } from 'bitcoinjs-lib';
import {script as bscript} from 'bitcoinjs-lib';

// import * as classify from 'bitcoinjs-lib/types/classify';
const classify = require('bitcoinjs-lib/src/classify');
// import * as types from 'bitcoinjs-lib/types/types';
const types = require('bitcoinjs-lib/src/types');
// import * as bcrypto from 'bitcoinjs-lib/types/crypto';
const bcrypto = require('bitcoinjs-lib/src/crypto');

const SCRIPT_TYPES = classify.types;
const typeforce = require('typeforce');

type HashTypeCheck = (hashType: number) => boolean;
type MaybeBuffer = Buffer | undefined;
type TxbSignatures = Buffer[] | MaybeBuffer[];
type TxbPubkeys = MaybeBuffer[];
type TxbWitness = Buffer[];
type TxbScriptType = string;
type TxbScript = Buffer;

interface SigningData {
	input: TxbInput;
	ourPubKey: Buffer;
	signer: SignerAsync;
	signatureHash: Buffer;
	hashType: number;
	useLowR: boolean;
}

interface TxbInput {
	value?: number;
	hasWitness?: boolean;
	signScript?: TxbScript;
	signType?: TxbScriptType;
	prevOutScript?: TxbScript;
	redeemScript?: TxbScript;
	redeemScriptType?: TxbScriptType;
	prevOutType?: TxbScriptType;
	pubkeys?: TxbPubkeys;
	signatures?: TxbSignatures;
	witness?: TxbWitness;
	witnessScript?: TxbScript;
	witnessScriptType?: TxbScriptType;
	script?: TxbScript;
	sequence?: number;
	scriptSig?: TxbScript;
	maxSignatures?: number;
}

interface TxbOutput {
	type: string;
	pubkeys?: TxbPubkeys;
	signatures?: TxbSignatures;
	maxSignatures?: number;
}

function canSign(input: TxbInput): boolean {
	return (
		input.signScript !== undefined &&
		input.signType !== undefined &&
		input.pubkeys !== undefined &&
		input.signatures !== undefined &&
		input.signatures.length === input.pubkeys.length &&
		input.pubkeys.length > 0 &&
		(input.hasWitness === false || input.value !== undefined)
	);
}

function expandOutput(script: Buffer, ourPubKey?: Buffer): TxbOutput {
	typeforce(types.Buffer, script);
	const type = classify.output(script);

	switch (type) {
		case SCRIPT_TYPES.P2PKH: {
			if (!ourPubKey) return { type };

			// does our hash160(pubKey) match the output scripts?
			const pkh1 = payments.p2pkh({ output: script }).hash;
			const pkh2 = bcrypto.hash160(ourPubKey);
			if (!pkh1!.equals(pkh2)) return { type };

			return {
				type,
				pubkeys: [ourPubKey],
				signatures: [undefined],
			};
		}

		case SCRIPT_TYPES.P2WPKH: {
			if (!ourPubKey) return { type };

			// does our hash160(pubKey) match the output scripts?
			const wpkh1 = payments.p2wpkh({ output: script }).hash;
			const wpkh2 = bcrypto.hash160(ourPubKey);
			if (!wpkh1!.equals(wpkh2)) return { type };

			return {
				type,
				pubkeys: [ourPubKey],
				signatures: [undefined],
			};
		}

		case SCRIPT_TYPES.P2PK: {
			const p2pk = payments.p2pk({ output: script });
			return {
				type,
				pubkeys: [p2pk.pubkey],
				signatures: [undefined],
			};
		}

		case SCRIPT_TYPES.P2MS: {
			const p2ms = payments.p2ms({ output: script });
			return {
				type,
				pubkeys: p2ms.pubkeys,
				signatures: p2ms.pubkeys!.map((): undefined => undefined),
				maxSignatures: p2ms.m,
			};
		}
	}

	return { type };
}

function prepareInput(
	input: TxbInput,
	ourPubKey: Buffer,
	redeemScript?: Buffer,
	witnessScript?: Buffer,
): TxbInput {
	if (redeemScript && witnessScript) {
		const p2wsh = payments.p2wsh({
			redeem: { output: witnessScript },
		}) as payments.Payment;
		const p2wshAlt = payments.p2wsh({ output: redeemScript }) as payments.Payment;
		const p2sh = payments.p2sh({ redeem: { output: redeemScript } }) as payments.Payment;
		const p2shAlt = payments.p2sh({ redeem: p2wsh }) as payments.Payment;

		// enforces P2SH(P2WSH(...))
		if (!p2wsh.hash!.equals(p2wshAlt.hash!))
			throw new Error('Witness script inconsistent with prevOutScript');
		if (!p2sh.hash!.equals(p2shAlt.hash!))
			throw new Error('Redeem script inconsistent with prevOutScript');

		const expanded = expandOutput(p2wsh.redeem!.output!, ourPubKey);
		if (!expanded.pubkeys)
			throw new Error(
				expanded.type +
					' not supported as witnessScript (' +
					bscript.toASM(witnessScript) +
					')',
			);
		if (input.signatures && input.signatures.some(x => x !== undefined)) {
			expanded.signatures = input.signatures;
		}

		const signScript = witnessScript;
		if (expanded.type === SCRIPT_TYPES.P2WPKH)
			throw new Error('P2SH(P2WSH(P2WPKH)) is a consensus failure');

		return {
			redeemScript,
			redeemScriptType: SCRIPT_TYPES.P2WSH,

			witnessScript,
			witnessScriptType: expanded.type,

			prevOutType: SCRIPT_TYPES.P2SH,
			prevOutScript: p2sh.output,

			hasWitness: true,
			signScript,
			signType: expanded.type,

			pubkeys: expanded.pubkeys,
			signatures: expanded.signatures,
			maxSignatures: expanded.maxSignatures,
		};
	}

	if (redeemScript) {
		const p2sh = payments.p2sh({ redeem: { output: redeemScript } }) as payments.Payment;

		if (input.prevOutScript) {
			let p2shAlt;
			try {
				p2shAlt = payments.p2sh({ output: input.prevOutScript }) as payments.Payment;
			} catch (e) {
				throw new Error('PrevOutScript must be P2SH');
			}
			if (!p2sh.hash!.equals(p2shAlt.hash!))
				throw new Error('Redeem script inconsistent with prevOutScript');
		}

		const expanded = expandOutput(p2sh.redeem!.output!, ourPubKey);
		if (!expanded.pubkeys)
			throw new Error(
				expanded.type +
					' not supported as redeemScript (' +
					bscript.toASM(redeemScript) +
					')',
			);
		if (input.signatures && input.signatures.some(x => x !== undefined)) {
			expanded.signatures = input.signatures;
		}

		let signScript = redeemScript;
		if (expanded.type === SCRIPT_TYPES.P2WPKH) {
			signScript = payments.p2pkh({ pubkey: expanded.pubkeys[0] }).output!;
		}

		return {
			redeemScript,
			redeemScriptType: expanded.type,

			prevOutType: SCRIPT_TYPES.P2SH,
			prevOutScript: p2sh.output,

			hasWitness: expanded.type === SCRIPT_TYPES.P2WPKH,
			signScript,
			signType: expanded.type,

			pubkeys: expanded.pubkeys,
			signatures: expanded.signatures,
			maxSignatures: expanded.maxSignatures,
		};
	}

	if (witnessScript) {
		const p2wsh = payments.p2wsh({ redeem: { output: witnessScript } });

		if (input.prevOutScript) {
			const p2wshAlt = payments.p2wsh({ output: input.prevOutScript });
			if (!p2wsh.hash!.equals(p2wshAlt.hash!))
				throw new Error('Witness script inconsistent with prevOutScript');
		}

		const expanded = expandOutput(p2wsh.redeem!.output!, ourPubKey);
		if (!expanded.pubkeys)
			throw new Error(
				expanded.type +
					' not supported as witnessScript (' +
					bscript.toASM(witnessScript) +
					')',
			);
		if (input.signatures && input.signatures.some(x => x !== undefined)) {
			expanded.signatures = input.signatures;
		}

		const signScript = witnessScript;
		if (expanded.type === SCRIPT_TYPES.P2WPKH)
			throw new Error('P2WSH(P2WPKH) is a consensus failure');

		return {
			witnessScript,
			witnessScriptType: expanded.type,

			prevOutType: SCRIPT_TYPES.P2WSH,
			prevOutScript: p2wsh.output,

			hasWitness: true,
			signScript,
			signType: expanded.type,

			pubkeys: expanded.pubkeys,
			signatures: expanded.signatures,
			maxSignatures: expanded.maxSignatures,
		};
	}

	if (input.prevOutType && input.prevOutScript) {
		// embedded scripts are not possible without extra information
		if (input.prevOutType === SCRIPT_TYPES.P2SH)
			throw new Error(
				'PrevOutScript is ' + input.prevOutType + ', requires redeemScript',
			);
		if (input.prevOutType === SCRIPT_TYPES.P2WSH)
			throw new Error(
				'PrevOutScript is ' + input.prevOutType + ', requires witnessScript',
			);
		if (!input.prevOutScript) throw new Error('PrevOutScript is missing');

		const expanded = expandOutput(input.prevOutScript, ourPubKey);
		if (!expanded.pubkeys)
			throw new Error(
				expanded.type +
					' not supported (' +
					bscript.toASM(input.prevOutScript) +
					')',
			);
		if (input.signatures && input.signatures.some(x => x !== undefined)) {
			expanded.signatures = input.signatures;
		}

		let signScript = input.prevOutScript;
		if (expanded.type === SCRIPT_TYPES.P2WPKH) {
			signScript = payments.p2pkh({ pubkey: expanded.pubkeys[0] })
				.output as Buffer;
		}

		return {
			prevOutType: expanded.type,
			prevOutScript: input.prevOutScript,

			hasWitness: expanded.type === SCRIPT_TYPES.P2WPKH,
			signScript,
			signType: expanded.type,

			pubkeys: expanded.pubkeys,
			signatures: expanded.signatures,
			maxSignatures: expanded.maxSignatures,
		};
	}

	const prevOutScript = payments.p2pkh({ pubkey: ourPubKey }).output;
	return {
		prevOutType: SCRIPT_TYPES.P2PKH,
		prevOutScript,

		hasWitness: false,
		signScript: prevOutScript,
		signType: SCRIPT_TYPES.P2PKH,

		pubkeys: [ourPubKey],
		signatures: [undefined],
	};
}

export default class TxBuilder extends bitcoin.TransactionBuilder {

	static fromTransaction(transaction: Transaction, network?: bitcoin.Network): TxBuilder {
		var tb = bitcoin.TransactionBuilder.fromTransaction(transaction, network);
		(tb as any).__proto__ = TxBuilder.prototype;
		return tb as TxBuilder;
	}

	async signAsync(index: number, signer: SignerAsync) {
		await this._trySign(
			this._getSigningData(
				this.network,
				(this as any).__INPUTS,
				(this as any).__needsOutputs.bind(this),
				(this as any).__TX,
				index,
				signer,
				(this as any).__USE_LOW_R,
			),
		);
	}

	private async _trySign({
		input,
		ourPubKey,
		signer,
		signatureHash,
		hashType,
		useLowR,
	}: SigningData) {
		// enforce in order signing of public keys
		let signed = false;
		for (const [i, pubKey] of input.pubkeys!.entries()) {
			if (!ourPubKey.equals(pubKey!)) continue;
			if (input.signatures![i]) throw new Error('Signature already exists');
	
			// TODO: add tests
			if (ourPubKey.length !== 33 && input.hasWitness) {
				throw new Error(
					'BIP143 rejects uncompressed public keys in P2WPKH or P2WSH',
				);
			}
	
			const signature = await signer.sign(signatureHash, useLowR);
			input.signatures![i] = bscript.signature.encode(signature, hashType);
			signed = true;
		}
	
		if (!signed) throw new Error('Key pair cannot sign for this input');
	}

	private _getSigningData(
		network: bitcoin.Network,
		inputs: TxbInput[],
		needsOutputs: HashTypeCheck,
		tx: Transaction,
		signParams: number,
		signer: SignerAsync,
		useLowR?: boolean,
	): SigningData {
		let vin: number = signParams;
		// TODO: remove keyPair.network matching in 4.0.0
		if (signer.network && signer.network !== network)
			throw new TypeError('Inconsistent network');
		if (!inputs[vin]) throw new Error('No input at index: ' + vin);
	
		var hashType = Transaction.SIGHASH_ALL;
		if (needsOutputs(hashType)) throw new Error('Transaction needs outputs');
	
		const input = inputs[vin];
	
		const ourPubKey = signer.publicKey;

		if (!canSign(input)) {
	
			if (!canSign(input)) {
				const prepared = prepareInput(
					input,
					ourPubKey
				);
	
				// updates inline
				Object.assign(input, prepared);
			}
	
			if (!canSign(input)) throw Error(input.prevOutType + ' not supported');
		}
	
		// ready to sign
		let signatureHash: Buffer;
		if (input.hasWitness) {
			signatureHash = tx.hashForWitnessV0(
				vin,
				input.signScript as Buffer,
				input.value as number,
				hashType,
			);
		} else {
			signatureHash = tx.hashForSignature(
				vin,
				input.signScript as Buffer,
				hashType,
			);
		}
	
		return {
			input,
			ourPubKey,
			signer,
			signatureHash,
			hashType,
			useLowR: !!useLowR,
		};
	}
	
}