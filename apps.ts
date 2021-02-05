/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

export interface ApplicationInfo {
	name: string;
	displayName: string;
	icon: string;
	appId: string;
	appKey: string;
	version: string;
	// filesHash: Dict<string>;
}

export function applications(): ApplicationInfo[] {
	return [];
}

export function applicationWithoutErr(appId: string): ApplicationInfo | null {
	return null;
}
