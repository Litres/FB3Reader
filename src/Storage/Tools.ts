export enum StorageType {
	NoStorage,
	LocalStorage,
	IndexedDB
}

const storageCheckFunction = {
	'localStorage': () => {
		let isAvailable = true;
		try {
			window.localStorage.setItem('FBReader_localStorage_working', '');
			window.localStorage.removeItem('FBReader_localStorage_working');
		} catch (e) {
			isAvailable = false;
		}

		return isAvailable;
	},
	'indexedDB': () => {
		if (typeof window === "undefined") {
			return false;
		}

		(<any> window)._indexedDB = (<any>window).indexedDB || (<any>window).mozIndexedDB || (<any>window).webkitIndexedDB || (<any>window).msIndexedDB;

		return (<any> window)._indexedDB !== null;
	}
};

export function bestStorageTypeAvailable(): StorageType {
	if (storageCheckFunction['indexedDB']() === true) {
		return StorageType.IndexedDB;
	}

	if (storageCheckFunction['localStorage']() === true) {
		return StorageType.LocalStorage;
	}

	return StorageType.NoStorage;
}