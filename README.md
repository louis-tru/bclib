Block chain bass libs
==============================

这是一个区块链Baas服务library


# 访问的基本方式与数据格式

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


# 服务授权访问算法与方法

服务授权访问通过非对称算法签名的方式访问，

目前服务支持两种算法签名 `secp256k1` 与 `rsa` 建议使用 `secp256k1`

要访问服务首先要在服务登记一个账号，这个账号包括`appId`也叫用户名、验证签名用的公钥、算法名称，私钥由用户自行保管

访问服务时由用户的私钥通过一定的算法对发送的数据进行签名即可，以下是签名算法步骤：

暂且只考虑`Post`方式

1.通过`sha256`算法计算`data`+`st`+`shareKey`得到256位长度的`hash`值

	data = http post 主体数据
	st = 发起请求的时间戳，时间戳必须有时效性目前是10分钟，发起请求时把这个时间戳放到请求头中 `st: 1614154609262`
	shareKey = b4dd53f2fefde37c07ac4824cf7086439633e3a357daacc3aaa16418275a9e51 注：这个是字符串非bin

2.把获得的hash通过特定的算法签名，并对其进行base64编码 后加入到请求头中 `sign: sign`

	如果是`rsa`算法签名即就是对hash用私钥加密的过程

3.把在服务器登记的 `appId` 加入到请求头中 `auth-user: xxxx`

这是算法过程简写： `sign(sha256(data + st + shareKey))`

以下是服务提供的具体api方法.

# keys

提供系列私钥链条（钥匙串）的管理方法，以及对普通数据签名的方法

## keys/genSecretKeys

生成钥匙串，返回钥匙串对应的地址列表，目前`size`限制需小于100

```ts
genSecretKeys({ size: number }): string[];
```

## keys/genSecretKeyFromPartKey

通过key生成子钥匙串，返回钥匙串对应的地址

```ts
genSecretKeyFromPartKey({ part_key: string }): string;
```

## keys/addressList

获取之前生成的钥匙串地址列表

```ts
addressList(): string[];
```

## keys/address

通过key获取对应的密钥地址，如果不传入`part_key`随机从之前生成的钥匙串列表中取出一个并返回对应的地址

```ts
address({ part_key?: string }): string;
```

## keys/unlock

通过密码解锁钥匙串，在调用需要签名的方法中必须先解锁，默认密码为`0000`

```ts
unlock({pwd: string}): void;
```

## keys/lock

锁定钥匙串

```ts
lock(): void;
```

## keys/setPassword

重设解锁钥匙串密码，重设后会锁定钥匙串

```ts
setPassword({oldPwd: string, newPwd: string}): void;
```

## keys/setUnlock

设置自动解锁key的密码，如果设置了解锁密码并且服务启动配置为可以自动解锁key，当key被锁定时服务会尝试会自动解锁

```ts
setUnlock({pwd: string}): void;
```

## keys/keychainKeystore

以Keystore形式导出钥匙串根密钥，这个`pwd`非解锁密码，导出前先解锁钥匙串

```ts
keychainKeystore({pwd: string}): object;
```

## keys/sign

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

# `tx`

提供web3上链服务以及协议的访问方法与协议的签名方法访问



## tx/serializedTx

对交易进行签名，序列化交易数据返回rawData

```ts
serializedTx({
	chain: number;
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

## tx/serializedTxForContract

调用协约交易进行签名，序列化交易数据返回rawData

```ts
serializedTxForContract({
	chain: number;
	address: string; // 协约地址
	method: string; // 协约方法名称
	args?: any[];  // 实参列表
	from?: string; // 发送交易的账户
	value?: string; // eth value
	nonce?: number;
}): {
	data: string; // rawData
	txid: string;
	nonce: number;
};
```


## tx/get

调用指定address协约方法

```ts
get({address: string, method: string, args: any[]}): any;
```


## tx/post

调用指定address协约方法，发送交易立即返回服务查询`review(id)`句柄id

```ts
post({
	chain: number; // chian id
	address: string; // 协约地址
	method: string; // 方法名
	args: any[]; // 实参
	from?: string; // 账户
	value?: string;
	callback?: string; // 回调地址,只有异步方法才生效
	retry?: number; // 发送上链错误后重试的次数，错误后加入到队列尾部等待
	timeout?: number; // 0表示不超时
	blockRange?: number; // 允许最大区块范围超时，超过区块后放弃交易视为失败，默认为32个区块
}): string; // 返回句柄id
```


## tx/review

```ts
review({ id: string }): PostResult;
```

查看定义[`PostResult`]


## tx/sendTx

签名交易数据并发送，发送交易立即返回服务查询`review(id)`句柄id

```ts
sendTx({
	chain: number;
	tx: {
		// timeout: 这个属性有两层意义，web3中所有的`timeout`都有同样的性质
		// 1.发送上链请求超时后丢弃这次发送的交易，如果还有重试次数会加入到队列尾部等待重新发送上链请求。
		// 2.上链之前在队列中允许等待的最长时间，timeout等于0时表示在队列等待中不超时。
		timeout?: number; 
		blockRange?: number; // 一次上链条请求中超过区块后放弃交易，默认为32个区块，如果一还有重度次数加入到队列尾部
		chainId?: number;
		from?: string;
		nonce?: number;
		to?: string;
		gasLimit?: number;
		gasPrice?: number;
		value?: string;
		data?: string;
		retry?: number; // 发送上链错误后重试的次数，错误后加入到队列尾部等待
	};
	callback?: string; // 回调地址url
}): string; // 返回句柄id
```


## tx/postSync

调用指定address协约方法，发送交易挂起运行，直接有结果返回，同步调用不入队列

```ts
postSync({
	chain: number;
	address: string; // 协约地址
	method: string; // 方法名
	args: any[]; // 实参
	from?: string; // 账户
	value?: string;
	retry?: number; // 发送上链错误后重试的次数，错误后加入到队列尾部等待
	timeout?: number; // 0表示不超时
	blockRange?: number; // 允许最大区块范围超时，超过区块后放弃交易视为失败，默认为32个区块
}): TransactionReceipt;
```

查看定义[`TransactionReceipt`]



## tx/sendSignTransactionSync

签名交易数据并发送，挂起http请求直到成功或者失败

```ts
sendSignTransactionSync({
	chain: number;
	tx: {
		timeout?: number; // 超时放弃交易
		blockRange?: number; // 允许最大区块范围超时，超过区块后放弃交易视为失败，默认为32个区块
		chainId?: number;
		from?: string;
		nonce?: number;
		to?: string;
		gasLimit?: number;
		gasPrice?: number;
		value?: string;
		data?: string;
		retry?: number; // 发送上链错误后重试的次数，错误后加入到队列尾部等待
	}
}): TransactionReceipt;
```

查看定义[`TransactionReceipt`]



## web3/sendSignedTransactionSync

发送签名后的交易数据`rawData`

```ts
sendSignedTransactionSync({
	chain: number;
	serializedTx: string; // rawData
	opts?: {
		timeout?: number; // 超时放弃交易
		blockRange?: number; // 超过区块后放弃交易视为失败，默认为32个区块
		retry?: number; // 发送上链错误后重试的次数，错误后加入到队列尾部等待
	}
}): TransactionReceipt;
```

查看定义[`TransactionReceipt`]




# interfaces




## TransactionReceipt

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

## PostResult

```ts
interface PostResult {
	receipt: TransactionReceipt;
	error?: Error;
	id?: string;
	tx: TxAsync;
}
```


## PostResult

```ts
interface TxAsync {
	id: number;
	account: string;
	contract?: string;
	method?: string;
	args?: string;
	opts: string;
	data?: string;
	cb?: string;
	txid?: string;
	status: number;
	time: number;
	active: number;
	chain: number;
	nonce: number;
	noneConfirm: number;
}
```


## Transaction

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



[`TransactionReceipt`]: #transactionreceipt
[`FindEventResult`]: #findeventresult
[`PostResult`]: #postresult
[`EventData`]: #eventdata
[`Transaction`]: #transaction