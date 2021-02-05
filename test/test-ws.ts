/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import { WSService } from 'somes/ws/service';
import {EventNoticer} from 'somes/event';

export default class TestWS extends WSService {

	readonly onTest = new EventNoticer('Test', this);

	async test() {
		this.onTest.trigger('Event Test');
		return 'ok';
	}

	async test2(data: any) {
		return data;
	}
	
}
