/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import server from 'somes/server';
import {Notification} from 'somes/event';
import mbus from 'somes/mbus';
import {WSService} from 'somes/ws/service';
import {WatchCat} from './watch';
import cfg from './cfg';

// ----------------------------------

export enum Events {
	RequestAuthorization = 'RequestAuthorization',
	DTTYD_PORT_FORWARD = 'DTTYD_PORT_FORWARD',
	DTTYD_PORT_FORWARD_END = 'DTTYD_PORT_FORWARD_END',
	WatchStatusChange = 'WatchStatusChange',
}

export class Mbus extends mbus.NotificationCenter {

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
	}
}

var default_bus: Mbus| null = null;

export interface MessagePost {
	post(event: string, data?: any): void;
}

export default {
	post(event: string, data?: any) {
		if (default_bus)
			default_bus.publish(event, data);
	}
} as MessagePost;

/**
* @class MessageCenter
*/
export class MessageCenter<T = any> extends Notification implements WatchCat<T>, MessagePost {

	private _mbus?: Mbus;

	constructor(_cfg?: {mbus: string; mbus_topic: string}) {
		super();
		var config = _cfg || cfg;
		if (config.mbus) {
			this._mbus = new Mbus(config.mbus, config.mbus_topic || 'default');
			this._mbus.subscribeAll();
			if (!default_bus) {
				default_bus = this._mbus;
				mbus.defaultNotificationCenter = this._mbus;
			}
		}
	}

	post(event: string, data?: any): void {
		this.trigger(event, data);
	}

	// @overwrite:
	getNoticer(name: string) {
		if (!this.hasNoticer(name)) {
			if (this._mbus) {
				this._mbus.addEventForward(name, super.getNoticer(name));
			} else {
				console.warn('not config mbus');
			}
		}
		return super.getNoticer(name);
	}

	// @overwrite:
	trigger(event: string, data: any) {
		if (this._mbus) {
			this._mbus.trigger(event, data);
		} else {
			console.warn('not config mbus');
		}
	}

	async cat(t: T) {
		return true;
	}
}