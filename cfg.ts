
import somes from 'somes';

const cfg = {
	name: 'bclib',
	var: '/data/bclib/var',
	server: { port: 8000, host: '127.0.0.1' },
	x_api: 'https://api.cryptoapis.io/v1/bc',
	x_api_key: '6ca420ec851339a7589675bc06afff846957bb6a',
	web3: 'http://127.0.0.1:7777',
	enable_auth: true,
	moreLog: true,
	mbus: 'mqtt://127.0.0.1:1883',
	mbus_topic: 'default',
	env: 'dev',
	private_key: '',
	amqp: 'amqp://127.0.0.1',
	apis: [] as string[],
	tests: [] as string[],
	chainId: 64,
	...somes.config,
};

export default Object.assign(somes.config, cfg);