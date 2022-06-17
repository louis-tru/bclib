/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-01-25
 */

import cfg from './cfg';

export const workers = Number(process.env.__WORKERS) && process.env.__WORKER ? {
	id: Number(process.env.__WORKER) || 0,
	worker: Number(process.env.__WORKER) || 0,
	workers: Number(process.env.__WORKERS) || 0,
}: null;

export const disableWeb = !!process.env.DISABLE_WEB;

export const env: 'prod' | 'dev' = cfg.env as any;

export const web3_tx_dequeue = cfg.web3_tx_dequeue || !!process.env.WEB3_TX_DEQUEUE;

export const type = process.env.MVP_TYPE || cfg.type;