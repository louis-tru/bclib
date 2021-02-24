# `BASS API`

## 访问的基本方式与数据格式

`http://127.0.0.1:8000/service-api` 这是bass服务api前缀，建议使用post方式访问

一般通过 `http://127.0.0.1:8000/service-api/web3/contractGet`这种形式访问

参数建议以 `post` `json` 方式发送，并在http请求头中加入 `Content-Type: application/json`

返回数据包含返回错误代码以及异常信息，`errno=0`表示这个请求是正确的非`0`表示错误代码

下面给出一个示例，这是一个返回正常返回number数据类型的数据包格式：

```json
	{
		"errno": 0,
		"data": 100,
		"st": 1614154465544
	}
```

以及更加复杂的数据返回格式：

```json
	{
		"data": {
			"r": "0x110984fb4a48e24c2058b17928cc6d13ff4fb1a1b26d70ef58aa0f780a6e03d4",
			"s": "0x0568755b66a471e5ae310f7ebb19be6379a171a268e4a940544281870c3684b1",
			"v": 0
		},
		"errno": 0,
		"st": 1614154465544
	}
```

这是调用异常时返回数据包装：

```json
	{
		"errno": 100238,
		"description": "",
		"name": "Error",
		"message": "ERR_KEY_STORE_UNLOCK",
		"st": 1614154609262
	}
```


## 服务授权访问算法与方法

服务授权访问通过非对称算法签名的方式访问，

目前服务支持两种算法签名 `secp256k1` 与 `rsa` 建议使用 `secp256k1`

要访问服务首先要在服务登记一个账号，这个账号包括`appId`也叫用户名、验证签名用的公钥、算法名称，私钥由用户自行保管

访问服务时由用户的私钥通过一定的算法对发送的数据进行签名即可，以下是签名算法步骤：

暂且只考虑`Post`方式

1.通过`sha1`算法计算`data`+`st`+`shareKey`得到`hash`

	data = http post 主体数据
	st = 发起请求的时间戳，时间戳必须有时效性目前是10分钟，发起请求时把这个时间戳放到请求头中 `st: 1614154609262`
	shareKey = b4dd53f2fefde37c07ac4824cf7086439633e3a357daacc3aaa16418275a9e51 注：这个是字符串非bin

2.把获得的hash通过特定的算法签名，并对其进行base64编码 后加入到请求头中 `sign: sign`

	如果是`rsa`算法签名即就是对hash用私钥加密的过程

3.把在服务器登记的 `appId` 加入到请求头中 `auth-user: xxxx`

这是算法过程简写： `sign(rsa1(data + st + shareKey))`

以下是服务提供的具体api方法.

## keys

提供系列私钥链条（钥匙串）的管理方法，以及对普通数据签名的方法

### genSecretKeys

生成钥匙串，返回钥匙串对应的地址列表，目前`size`限制需小于100

```ts
genSecretKeys({ size: number }): string[];
```

### addressList

获取之前生成的钥匙串地址列表

```ts
addressList(): string[];
```

### address

随机从之前生成的钥匙串列表中取出一个并返回对应的地址

```ts
address(): string;
```

### unlock

通过密码解锁钥匙串，在调用需要签名的方法中必须先解锁，默认密码为`0000`

```ts
unlock({pwd: string}): void;
```

### lock

锁定钥匙串

```ts
lock(): void;
```

### setPassword

重设解锁钥匙串密码，重设后会锁定钥匙串

```ts
setPassword({oldPwd: string, newPwd: string}): void;
```

### keychainKeystore

以Keystore形式导出钥匙串根密钥，这个`pwd`非解锁密码，导出前先解锁钥匙串

```ts
keychainKeystore({pwd: string}): object;
```

### sign

系列数据签名方法, 调用这些方法前需先解锁钥匙串

`from` 是可选参数，如果服务设置过默认账号不传入`from`会使用默认账户进行签名

如果找不到账户会抛出异常。

```ts
signData({ data: any, from?: string }): {
	r: string; // 0x5a76697e0be25dd28e247c12f865f49500a1625b1c00483acbe9a64041720d50
	s: string; // 0x15bf47dd784c39a38c0d2dc638f4c463e2b76dad9378362f16ef919e1e48c926
	v: number; // 1
};
// sign(kk256(jsonstringify(data)))
```

```ts
signString({ data: string, from?: string }): {
	r: string;
	s: string;
	v: number;
};
// 过程： sign(kk256(data))
```

```ts
signDatas({ datas: any[], from?: string }): [{
	r: string;
	s: string;
	v: number;
}];
// 过程： foreach sign(kk256(jsonstringify(data)))
```

```ts
signMessages({ hash32Hexs: string[], from?: string }): [{
	r: string;
	s: string;
	v: number;
}];
// 过程：foreach sign(data)
```

```ts
type Type = 
	'address'|
	'int256'|
	'int160'|
	'int128'|
	'int64'|
	'int32'|
	'int16'|
	'int8'|
	'uint256'|
	'uint160'|
	'uint128'|
	'uint64'|
	'uint32'|
	'uint16'|
	'uint8'|
	'byte32';

signArgumentsFromTypes({ data: any[], types: Type[], from?: string }): {
	r: string;
	s: string;
	v: number;
};
```

签名 arguments 下面是调用实例：

```ts
signArgumentsFromTypes({
	data: [
		"0x1Bf35f0Bad5A74103FC9707db4b2bE9559B4Ea7A", 
		"0x17c8cc211d5749d502dc3dd65a89874d68f4e0e40596a02bf4747f7664e67670"
	], 
	"types": ["address", "byte32"],
	"from": "0x1Bf35f0Bad5A74103FC9707db4b2bE9559B4Ea7A"
});
```

返回：

```json
{
	"r": "0x4608a027884c2b3fa802bc0ce60c3e22e2c8f33d491f5a6e5e55186abd87735f",
	"s": "0x63a48617e63dd327de4ce6d64a6e0fbb226a199bb2d696e31f9ba9c9de8f5d11",
	"v": 0
}
```

## `web3`

提供web3上链服务以及协议的访问方法与协议的签名方法访问

### contract call

调用指定address协约方法

```ts
contractGet({address: string, method: string, args: any[]}): any;
```

调用指定address协约方法，发送交易立即返回服务查询`review(id)`句柄id

```ts
contractPost({
	address: string; // 协约地址
	method: string; // 方法名
	args: any[]; // 实参
	event:? string; // 发送交易成功后需要检查的event
	from?: string; // 账户
}): string; // 返回句柄id
```

调用指定address协约方法，发送交易关挂起运行，直接有结果返回

```ts
contractPostSync({
	address: string; // 协约地址
	method: string; // 方法名
	args: any[]; // 实参
	event:? string; // 发送交易成功后需要检查的event
	from?: string; // 账户
}): TransactionReceipt;
```

查看定义[`TransactionReceipt`]

### get

调用具名的协约方法

```ts
bankGet({method: string, args: string}): any;
```

```ts
erc20Get({method: string, args: string}): any;
```

```ts
erc721Get({method: string, args: string}): any;
```

```ts
proofGet({method: string, args: string}): any;
```

```ts
casperGet({method: string, args: string}): any;
```

```ts
starGet({method: string, args: string}): any;
```

```ts
minerGet({method: string, args: string}): any;
```

```ts
miningGet({method: string, args: string}): any;
```

### post

调用具名的协约方法,发送交易立即返回服务查询`review(id)`句柄id

```ts
bankPost({method: string, args: any[], event? string, from?: string}): string;
```

```ts
erc20Post({method: string, args: any[], event? string, from?: string}): string;
```

```ts
erc721Post({method: string, args: any[], event? string, from?: string}): string;
```

```ts
proofPost({method: string, args: any[], event? string, from?: string}): string;
```

```ts
casperPost({method: string, args: any[], event? string, from?: string}): string;
```

```ts
starPost({method: string, args: any[], event? string, from?: string}): string;
```

```ts
minerPost({method: string, args: any[], event? string, from?: string}): string;
```

```ts
miningPost({method: string, args: any[], event? string, from?: string}): string;
```

### review

```ts
review({ id: string }): PostResult;
```

查看定义[`PostResult`]

### contractAddress

获取具名协约地址

```ts
contractAddress({type: ABIType}): string;
```

查看定义[`ABIType`]

### getBlockNumber

获取区块高度

```ts
getBlockNumber(): number;
```

### getNonce({account: string}): number;

获取账户的当前nonce

### getNonceQueue

通过account申请nonce，会以自增方式增加值，如果长时间不使用申请的nonce会自动重新被分配

```ts
getNonceQueue({account: string}): {
	from: string;
	nonce: number;
	gasLimit: number;
};
```

### serializedTx

对交易进行签名，序列化交易数据返回rawData

```ts
serializedTx({
	tx: {
		chainId?: number;
		from?: string;
		nonce?: number;
		to?: string;
		gasLimit?: number;
		gasPrice?: number;
		value?: string;
		data?: string;
	}
}): {
	data: string;
	txid: string;
	nonce: number;
};
```

### serializedTxForContract

调用协约交易进行签名，序列化交易数据返回rawData

```ts
serializedTxForContract({
	method: string; // 协约方法名称
	args?: any[];  // 实参列表
	from?: string; // 发送交易的账户
	address: string; // 协约地址
}): {
	data: string; // rawData
	txid: string;
	nonce: number;
};
```

### sendSignTransaction

签名交易数据并发送，挂起http请求直到成功或者失败

```ts
sendSignTransaction({
	tx: {
		timeout?: number; // 超时放弃交易
		blockRange?: number; // 超过区块后放弃交易视为失败，默认为32个区块
		chainId?: number;
		from?: string;
		nonce?: number;
		to?: string;
		gasLimit?: number;
		gasPrice?: number;
		value?: string;
		data?: string;
	}
}): TransactionReceipt;
```

查看定义[`TransactionReceipt`]

### sendSignedTransaction

发送签名后的交易数据`rawData`

```ts
sendSignedTransaction({
	serializedTx: string; // rawData
	opts?: {
		timeout?: number; // 超时放弃交易
		blockRange?: number; // 超过区块后放弃交易视为失败，默认为32个区块
	}
});
```

## interfaces


### TransactionReceipt

```ts
interface TransactionReceipt {
	status: boolean;
	transactionHash: string;
	transactionIndex: number;
	blockHash: string;
	blockNumber: number;
	from: string;
	to: string;
	contractAddress?: string;
	cumulativeGasUsed: number;
	gasUsed: number;
	logs: {
		address: string;
		data: string;
		topics: string[];
		logIndex: number;
		transactionIndex: number;
		transactionHash: string;
		blockHash: string;
		blockNumber: number;
	}[];
	logsBloom: string;
	events?: {
		[eventName: string]: EventData;
	};
}
```

### PostResult

```ts
interface PostResult {
	receipt: TransactionReceipt;
	event?: FindEventResult;
	data?: any;
}
```

### FindEventResult

```ts
interface FindEventResult {
	event: EventData;
	transaction: Transaction;
}
```

### EventData

```ts
interface EventData {
	returnValues: {
			[key: string]: any;
	};
	raw: {
			data: string;
			topics: string[];
	};
	event: string;
	signature: string;
	logIndex: number;
	transactionIndex: number;
	transactionHash: string;
	blockHash: string;
	blockNumber: number;
	address: string;
}
```

### Transaction

```ts
interface Transaction {
	hash: string;
	nonce: number;
	blockHash: string | null;
	blockNumber: number | null;
	transactionIndex: number | null;
	from: string;
	to: string | null;
	value: string;
	gasPrice: string;
	gas: number;
	input: string;
}
```

### ABIType

```ts
enum ABIType {
	STAR = 1, // Deprecated
	BANK = 2,
	KUN = 3, // Deprecated
	BIGBANG = 5, // Deprecated
	ERC20 = 6,
	ERC721 = 7,
	MINING = 8, // Deprecated
	MINER = 11, // Deprecated
	KUN_CTR = 33, // Deprecated
	PROOF = 40, 
	CASPER = 41,
};
```

[`TransactionReceipt`]: #TransactionReceipt
[`FindEventResult`]: #FindEventResult
[`PostResult`]: #PostResult
[`EventData`]: #EventData
[`Transaction`]: #Transaction
[`ABIType`]: #ABIType