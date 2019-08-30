/// <reference path="StorageHead.ts" />

module FB3Storage {
	export const INDEXED_DB: string = 'indexeddb';
	export const LOCAL_STORAGE: string = 'localstorage';
	export const NO_STORAGE: string = 'nostorage';

	var LocalStorage: boolean; // global for window.localStorage check

	export function CheckStorageAvail(): string {
		if (CheckIndexedDBAvail()) {
			return INDEXED_DB;
		}

		if (CheckLocalStorageAvail()) {
			return LOCAL_STORAGE;
		}

		return NO_STORAGE;
	}

	export function CheckLocalStorageAvail(): boolean {
		if (LocalStorage !== undefined) {
			return LocalStorage;
		}
		try {
			window.localStorage['working'] = 'true';
			LocalStorage = true;
			window.localStorage.removeItem('working');
		} catch (e) {
			LocalStorage = false;
		}
		return LocalStorage;
	}

	export function CheckIndexedDBAvail(): boolean {
		// TS doesn't know about prefixes
		(<any>window).indexedDB = window.indexedDB || (<any>window).mozIndexedDB || (<any>window).webkitIndexedDB || (<any>window).msIndexedDB;

		return window.indexedDB !== null;
	}

	export class LocalStorageDriver implements IStorageDriver {
		private Consumer: any;
		private CacheMarkupsList: IPageRenderInstructionsCacheEntry[];

		public readonly IsLocal: boolean = true;

		constructor(Consumer: any, private MaxCacheRecords, private OnLRUCleared = (arr: Array<any>) => {}) {
			this.Consumer = Consumer;
		}

		private DecodeData(Data) {
			try {
				if (this.Consumer.Encrypt) {
					return JSON.parse(LZString.decompressFromUTF16(Data));
				}
				return JSON.parse(Data);
			} catch (e) {
				return [];
			}
		}

		private EncodeData(Data) {
			try {
				if (this.Consumer.Encrypt) {
					return LZString.compressToUTF16(JSON.stringify(Data));
				}
				return JSON.stringify(Data);
			} catch (e) {
				return '';
			}
		}

		private LRU(Key, CacheMarkupList) {
			for (var I = 0; I < this.CacheMarkupsList.length; I++) {
				if (this.CacheMarkupsList[I].Key == Key) {
					this.CacheMarkupsList.splice(I, 1);
				}
			}

			this.OnLRUCleared(this.CacheMarkupsList.splice(0, this.CacheMarkupsList.length - this.MaxCacheRecords + 1));

			this.CacheMarkupsList.push(CacheMarkupList);
		}

		public LoadData(StoreName: string, Callback = (CacheMarkupsList: IPageRenderInstructionsCacheEntry[]) => {}): string {
			var Data = this.DecodeData(localStorage[StoreName]);

			this.CacheMarkupsList = Data;
			Callback(Data);

			return '';
		}

		public SaveData(StoreName: string,
						Key: String,
						CacheMarkupList: IPageRenderInstructionsCacheEntry,
						Data?: IPageRenderInstructionsCacheEntry[],
						Callback?: Function): void {
			this.CacheMarkupsList = Data;
			this.LRU(Key, CacheMarkupList);
			Callback(localStorage[StoreName] = this.EncodeData(Data));
		}

		public Find(StoreName: string, Key, Callback?: (CacheMarkupList) => void) {
			if (!this.CacheMarkupsList) {
				this.LoadData(StoreName);
			}

			for (var I = 0; I < this.CacheMarkupsList.length; I++) {
				if (this.CacheMarkupsList[I].Key == Key) {
					Callback(this.CacheMarkupsList[I]);
					return;
				}
			}

			Callback(null);
		}
	}

	const DB_NAME = 'FB3ReaderDB';

	interface IndexedDBEventTarget extends EventTarget {
		result: any;
		transaction: IDBTransaction;
	}

	export class IndexedDBDriver implements IStorageDriver {
		private db: IDBDatabase = null;
		private Consumer: any;
		private openRequest: IDBOpenDBRequest = null;

		public readonly IsLocal: boolean = false;
		public IsReady: boolean = false;
		public InitFailed: boolean = false;

		public OnReadyCallback: () => void = () => {};
		public OnInitErrorCallback: (e) => void = () => {};

		constructor(Consumer: any) {
			this.Consumer = Consumer;
			this.InitDatabase();
		}

		private InitDatabase() {
			this.IsReady = false;
			// need parseInt() for IE fix
			this.openRequest = window.indexedDB.open(DB_NAME, parseInt(IndexedDBDriver.GetIndexedDBVersion(AppVersion)) || 1);
			this.openRequest.onsuccess = this.OnSuccess.bind(this);
			this.openRequest.onupgradeneeded = this.OnUpgradeEnded.bind(this);
			this.openRequest.onerror = this.OnInitError.bind(this);
		}

		private OnInitError(e) {
			console.warn('IndexedDB failed to load', e);
			this.InitFailed = true;
			this.OnInitErrorCallback(e);
		}

		private OnSuccess(e) {
			this.db = (<IndexedDBEventTarget> e.target).result;
			this.IsReady = true;
			this.OnReadyCallback();
		}

		private OnUpgradeEnded(e) {
			this.db = e.target.result;
			if (!this.HasObjectStore('FBReaderStore')) {
				this.CreateObjectStore('FBReaderStore', {keyPath: 'Key'});
			}
			if (!this.HasObjectStore('FBTextCacheStore')) {
				const FBTextCacheStore = this.CreateObjectStore('FBTextCacheStore', {keyPath: ['ArtKey', 'ChunkAlias']});
				FBTextCacheStore.createIndex('ArtKey, ChunkAlias', ['ArtKey', 'ChunkAlias']);
			}
			if (!this.HasObjectStore('FBMediaCacheStore')) {
				this.CreateObjectStore('FBMediaCacheStore');
			}
		}

		private UseDatabase(Callback: Function = () => {}) {
			if (!this.IsReady) {
				this.openRequest.onsuccess = (e) => {
					this.OnSuccess(e);
					Callback();
				};
				return;
			}

			Callback();
		}

		public CreateObjectStore(StoreName, optionalParameters?) {
			return this.db.createObjectStore(StoreName, optionalParameters);
		}

		public HasObjectStore(StoreName) {
			return this.db.objectStoreNames.contains(StoreName);
		}

		private GetObjectStore(StoreName: string) {
			var transaction = this.db.transaction(StoreName, 'readwrite');
			return transaction.objectStore(StoreName);
		}

		private OnError(e) {
			console.warn(e);
		}

		public CreateTransaction(StoreNames: string[]) {
			return this.db.transaction(StoreNames, 'readwrite');
		}

		public SaveData(StoreName: string,
						Key: string,
						DataToSave: any,
						Data?: IPageRenderInstructionsCacheEntry[],
						Callback = () => {},
						FailureCallback = (e) => {}): void {
			this.UseDatabase((e) => {
				const store = this.GetObjectStore(StoreName);
				this.db.onerror = this.OnError.bind(this);

				try {
					const request = store.put(DataToSave);
					request.onsuccess = (e) => {
						Callback();
					}
				} catch(e) {
					FailureCallback(e);
				}
			});
		}

		SaveBlobData(StoreName: string,
					 ArrayKey: IDBArrayKey,
					 BlobToSave: Blob,
					 Callback = () => {}): void {
			try {
				const store = this.GetObjectStore(StoreName);
				this.db.onerror = this.OnError.bind(this);

				const request = store.put(BlobToSave, ArrayKey);
				request.onsuccess = (e) => {
					Callback();
				}
			} catch (e) {
				// Fallback in case if Blob data can't be stored
				const reader = new FileReader();
				// @ts-ignore
				reader.onload = (event: FileReaderEvent) => {
					this.db.onerror = this.OnError.bind(this);

					const store = this.GetObjectStore(StoreName);
					const StringDataToSave = event.target.result;

					const request = store.put(StringDataToSave, ArrayKey);
					request.onsuccess = (e) => {
						Callback();
					}
				}
			}
		}

		public Find(StoreName: string, Key: string | IDBArrayKey, Callback: Function = () => {}) {
			this.UseDatabase((e) => {
				var store = this.GetObjectStore(StoreName),
					request = store.get(Key);

				request.onsuccess = (e) => {
					Callback(request.result);
				}
			})
		}

		public Index(StoreName: string, IndexName: string, IndexData: Array<string>, Callback: Function = () => {}, FailureCallback: Function = () => {}) {
			this.UseDatabase((e) => {
				const store = this.GetObjectStore(StoreName);
				// checking for an index first
				if (store.indexNames.contains(IndexName)) {
					const index = store.index(IndexName);
					const request = index.get(IndexData);

					request.onsuccess = (e) => {
						Callback(request.result);
					}
				} else {
					FailureCallback();
				}
			})
		}

		public Filter(StoreName: string, FilterFunction: Function = () => {}, Callback: Function = () => {}, ActiveTransaction?: IDBTransaction) {
			this.UseDatabase((e) => {
				const store = ActiveTransaction ? ActiveTransaction.objectStore(StoreName) : this.GetObjectStore(StoreName);

				this.db.onerror = this.OnError.bind(this);

				store.openCursor().onsuccess = (e) => {
					var cursor = (<IndexedDBEventTarget> e.target).result;

					if (cursor) {
						if (FilterFunction(cursor) === false) {
							cursor.delete();
						}
						cursor.continue();
					} else {
						Callback((<IndexedDBEventTarget> e.target).transaction);
					}
				}
			});
		}

		public LoadData(StoreName: string, Callback = (data) => {}) {
			this.UseDatabase((e) => {
				var store = this.GetObjectStore(StoreName);

				this.db.onerror = this.OnError.bind(this);

				var data = [];
				store.openCursor().onsuccess = (e) => {
					var cursor = (<IndexedDBEventTarget> e.target).result;

					if (cursor) {
						data.push(cursor.value);
						cursor.continue();
					} else {
						Callback(data);
					}
				}
			});

			return '';
		}

		private static GetIndexedDBVersion(AppVersion: string): string {
			let versionAsArray = AppVersion.split('.');
			while(versionAsArray.length !== 3) {
				versionAsArray.push('0');
			}
			// padStart(3, '0')
			versionAsArray = versionAsArray.map(v => {
				while(v.length !== 3) {
					v = `0${v}`;
				}
				return v;
			});
			return versionAsArray.join('');
		}
	}

}
