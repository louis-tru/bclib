/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import {ErrnoList as SysErrnoList} from 'somes/errno';

export class ErrnoList extends SysErrnoList {
	ERR_PARAMS_ERROR: ErrnoCode = [100102, '参数错误']
	ERR_USER_FORBIDDEN_ACTION: ErrnoCode = [100105, '请求无响应或被拒绝']
	ERR_LAST_ACTION_NOT_COMPLETED: ErrnoCode = [100215, '已有用户发起请求，请稍后尝试']
	ERR_BIND_AUTH_FAIL: ErrnoCode = [100245, '绑定授权失败']
	ERR_BIND_AUTH_TIMEOUT: ErrnoCode = [100264, '绑定授权失败超时']
	ERR_AUTHORIZATION_FAIL: ErrnoCode = [100267, '应用授权访问失败']
	ERR_AUTH_USER_NON_EXIST: ErrnoCode = [100271, '授权用户不存在']
	ERR_HTTP_STATUS_NO_200: ErrnoCode = [100272, 'ERR_HTTP_STATUS_NO_200']
	ERR_NOT_ACTION_CONTEXT: ErrnoCode = [100216, '请求已失效', '没有动作上下文']
	ERR_INTRRNET_NOT_AVAILABLE: ErrnoCode = [100240, '网络连接不可用', 'Inetrnet连接不可用']
	ERR_REQUEST_TIMEOUT: ErrnoCode = [100232, '请求操时', '请求操时']
	ERR_METHOD_NOT_FOUND: ErrnoCode = [100233, 'ERR_METHOD_NOT_FOUND']
	ERR_DATA_TABLE_NOT_FOUND: ErrnoCode = [100237, '找不到数据表']
	ERR_KEY_STORE_UNLOCK: ErrnoCode = [100238, 'ERR_KEY_STORE_UNLOCK']
	ERR_GEN_KEYS_SIZE_LIMIT: ErrnoCode = [100239, 'ERR_GEN_KEYS_SIZE_LIMIT']
	ERR_STAR_ADDRESS_NOT_FOUND: ErrnoCode = [100273, 'ERR_STAR_ADDRESS_NOT_FOUND', 'call getABIsAddressFromStar()']
	ERR_GET_ABI_NOT_FOUND: ErrnoCode = [100274, 'ERR_GET_ABI_NOT_FOUND', 'call getAbiFromType() API to return null data']
	ERR_REQ_DASSET_ERR: ErrnoCode = [100275, 'ERR_REQ_DASSET_ERR', 'ERR_REQ_DASSET_ERR']
	ERR_WEB3_API_POST_EVENT_NON_EXIST: ErrnoCode = [100270, '交易事件不存在']
	ERR_WEB3_API_POST_NON_EXIST: ErrnoCode = [100268, '交易不存在']
	ERR_WEB3_API_POST_PENDING: ErrnoCode = [100269, '交易正在处理中']
	ERR_NO_ADDRESS_IS_CREATED: ErrnoCode = [100276, '还没有创建过地址']
	ERR_KEY_NOT_FOUND: ErrnoCode = [100277, 'ERR_KEY_NOT_FOUND', '找不到KEY']
	ERR_NO_ACCESS_KEY_PERMISSION: ErrnoCode = [100278, 'ERR_NO_ACCESS_KEY_PERMISSION']
	ERR_NO_DEFAULT_SECRET_KEY: ErrnoCode = [100279, 'ERR_NO_DEFAULT_SECRET_KEY']
	ERR_ADDRESS_IS_EMPTY: ErrnoCode = [100280, 'ERR_ADDRESS_IS_EMPTY', 'address or from account is empty']
	ERR_APPLICATION_FOUND: ErrnoCode = [100265, '找不到应用程序']
}

export default new ErrnoList;