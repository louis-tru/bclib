
import somes from 'somes';

const cfg = {
	name: 'bclib',
	type: 'web',
	var: '/data/bclib/var',
	server: { port: 8000, host: '127.0.0.1' },
	chain: 'http://chainapi-dev.stars-mine.com/v1',
	dasset: 'http://dasset-develop.stars-mine.com/api',
	dasset_appid: 'dAd26cd9145835537b',
	dasset_secret_key: '17e72914502530026917103952b6e010',
	baas: 'https://dphoto-baas.stars-mine.com/service-api',
	x_api: 'https://api.cryptoapis.io/v1/bc',
	x_api_key: '6ca420ec851339a7589675bc06afff846957bb6a',
	web3: 'http://127.0.0.1:7777',
	enable_strict_keys_permission_check: true,
	enable_auth: true,
	moreLog: true,
	mbus: 'mqtt://127.0.0.1:1883',
	mbus_topic: 'default',
	mbus_auth: '',
	env: 'dev',
	keys: '',
	keys_auto_unlock: false,
	web3_tx_dequeue: false,
	amqp: 'amqp://127.0.0.1',
	apis: [] as string[],
	tests: [] as string[],
	chainId: 64,
	auhorizationtApps: [] as ({ appId: string; appKey: string; keyType?: 'rsa'| 'secp256k1' }[] | undefined),
	internetTest: [] as string[] | undefined,
	filesSecurityVi: '0xc84a565d48ec73b79b984e4508196d66',
	filesSecurityKey: '0xedc86f52e40fb6f031dd429e24c42a1901ee522654cb23a3b51e98aabe7d2d3b',
	qiniu: undefined as { scope: string, zone: string, accessKey: string, secretKey: string } | undefined,
	fastStart: false,
	redis: 'redis://127.0.0.1:6379/0', // redis cfg
};

export default cfg;

Object.assign(cfg, somes.config);

exports.default = Object.assign(somes.config, cfg);
