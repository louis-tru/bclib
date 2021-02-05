/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import utils from 'somes';
import server from 'somes/server';
import mbus from 'somes/mbus';
import {WSService} from 'somes/ws/service';
import {WatchCat} from './watch';

// ----------------------------------

export enum Events {
	RequestAuthorization = 'RequestAuthorization',
	DTTYD_PORT_FORWARD = 'DTTYD_PORT_FORWARD',
	DTTYD_PORT_FORWARD_END = 'DTTYD_PORT_FORWARD_END',
	WatchStatusChange = 'WatchStatusChange',
}

/**
 * @class MessageCenter
 */
class MessageCenter extends mbus.NotificationCenter implements WatchCat {

	constructor(url?: string, topic?: string) {
		super(url, topic);
		this.subscribeAll();
	}

	afterNotificationHandle(event: string, data: any) {
		super.afterNotificationHandle(event, data);
		if (server.shared) {
			// broadcast message to all websocket client
			for (var conv of server.shared.wsConversations) {
				var handles = conv.handles;
				if (handles.message)
					(handles.message as WSService).trigger(event, data);
			}
		}
		return 0;
	}

	send(event: string, data?: any): void {
		this.trigger(event, data);
	}

	async cat() {
		// TODO ...
		return true;
	}

}

const msg = new MessageCenter(utils.config.mbus || 'mqtt://127.0.0.1:1883', utils.config.mbus_topic || 'default');

mbus.defaultNotificationCenter = msg;

export default msg;
	
