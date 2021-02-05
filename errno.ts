/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import {ErrnoList as SysErrnoList} from 'somes/errno';

class ErrnoList extends SysErrnoList {
	ERR_PARAMS_ERROR: ErrnoCode = [100102, '参数错误']
	ERR_USER_FORBIDDEN_ACTION: ErrnoCode = [100105, '请求无响应或被拒绝']
	ERR_LAST_ACTION_NOT_COMPLETED: ErrnoCode = [100215, '已有用户发起请求，请稍后尝试']
	ERR_BIND_AUTH_FAIL: ErrnoCode = [100245, '绑定授权失败']
	ERR_BIND_AUTH_TIMEOUT: ErrnoCode = [100264, '绑定授权失败超时']
	ERR_AUTHORIZATION_FAIL: ErrnoCode = [100267, '应用授权访问失败']
	ERR_AUTH_TOKEN_NON_EXIST: ErrnoCode = [100271, '授权Token不存在']
	ERR_HTTP_STATUS_NO_200: ErrnoCode = [100272, 'ERR_HTTP_STATUS_NO_200']
	ERR_NOT_ACTION_CONTEXT: ErrnoCode = [100216, '请求已失效', '没有动作上下文']
	ERR_INTRRNET_NOT_AVAILABLE: ErrnoCode = [100240, '网络连接不可用', 'Inetrnet连接不可用']
	ERR_REQUEST_TIMEOUT: ErrnoCode = [100232, '请求操时', '请求操时']
	ERR_METHOD_NOT_FOUND: ErrnoCode = [100233, 'ERR_METHOD_NOT_FOUND']
}

export default new ErrnoList;