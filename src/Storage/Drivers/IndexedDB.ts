import {
	IStorageCollection,
	IStorageDriver,
	ICollectionIndex,
	ICollectionQuery,
	IStorageTransaction, ICacheStrategy, ICollectionTrigger, CollectionTriggerAction
} from "../index.head";

/**
 * IndexedDB has StoreObject which will be our implementation of IStorageCollection
 */

interface IndexedDBEventTarget extends EventTarget {
	result: any;
	transaction: IDBTransaction;
}

interface IndexedDBIndex {
	name: string;
	unique: boolean;
	path: string[];
}

export class IndexedDBObjectStore<TCollectionSchema> implements IStorageCollection<TCollectionSchema> {
	private driver: IndexedDBDriver;
	private cacheStrategy: ICacheStrategy<TCollectionSchema>;

	private readonly objectStoreName: string;
	private readonly primaryKey: string[] | null;

	private indexes: IndexedDBIndex[] = [];

	private triggers: ICollectionTrigger<TCollectionSchema>[] = [];

	constructor(name: string, primaryKey?: string[]) {
		this.objectStoreName = name;
		if (primaryKey !== undefined) {
			this.primaryKey = primaryKey;
		}
	}

	public useCacheStrategy(cacheStrategy: ICacheStrategy<TCollectionSchema>): void {
		if (this.driver) {
			throw "[IndexedDBObjectStore] Unable to use cacheStrategy after initialization";
		}

		if (this.cacheStrategy) {
			throw "[IndexedDBObjectStore] Unable to use cacheStrategy when another cacheStrategy is being used";
		}

		if (!this.primaryKey) {
			throw "[IndexedDBObjectStore] Unable to use cacheStrategy without primaryKey set";
		}

		this.cacheStrategy = cacheStrategy;
		this.cacheStrategy.setUniqueKeyPath(this.primaryKey);
	}

	public isCreated(): boolean {
		return this.driver && this.driver.getIDBInstance().objectStoreNames.contains(this.objectStoreName);
	}

	public isInitialized(): boolean {
		return true;
	}

	public create(): void {
		if (!this.driver.getIDBInstance()) {
			throw "[IndexedDBObjectStore] Can't create IndexedDBObjectStore class when IDB instance is not accessible";
		}

		if (this.isCreated()) {
			throw "[IndexedDBObjectStore] Can't create IndexedDBObjectStore because it is already created";
		}

		if (this.primaryKey) {
			this.driver.getIDBInstance().createObjectStore(this.objectStoreName, {keyPath: this.primaryKey});
		} else {
			this.driver.getIDBInstance().createObjectStore(this.objectStoreName);
		}
	}

	public updateIndexes(versionChangeTransaction: IDBTransaction): void {
		this.indexes.forEach(index => {
			if (!this.getObjectStore(versionChangeTransaction).indexNames.contains(index.name)) {
				this.getObjectStore(versionChangeTransaction).createIndex(index.name, index.path);
			}
		});
	}

	public initialize(): void {}

	public createIndex(name: string, path: string[], unique: boolean = false) {
		if (this.driver) {
			throw `[IndexedDBObjectStore] Indexes must be added before the initializing`;
		}

		this.indexes.push({name, path, unique});
	}

	public getName(): string {
		return this.objectStoreName;
	}

	public setDriver(driver: IndexedDBDriver) {
		this.driver = driver;
	}

	public newQuery(objectStore: IDBObjectStore): ICollectionQuery<TCollectionSchema> {
		const put = (newRecord: TCollectionSchema, key?: any[]): Promise<void> => {
			return new Promise<void>((resolve, reject) => {
				try {
					const request = key ? objectStore.put(newRecord, key) : objectStore.put(newRecord);
					request.onsuccess = (e) => {
						this.triggers.filter(trigger => trigger.action === CollectionTriggerAction.Delete).forEach(trigger => trigger.callbackFunction(newRecord));
						resolve()
					};
				} catch(e) {
					reject(e);
				}
			});
		};

		return {
			put: (newRecord: TCollectionSchema, key?: any[]): Promise<void> => {
				return new Promise<void>((resolve, reject) => {
					if (this.cacheStrategy) {
						const newRecordKeyPath = this.primaryKey.map(key => newRecord[key]);
						this.newQuery(objectStore).get(newRecordKeyPath).then(() => {
							// we will overwrite, don't perform Cache Policy check
							put(newRecord, key).then(() => resolve()).catch(e => reject(e));
						}).catch(() => {
							// no such record - perform Cache Policy check
							this.newQuery(objectStore).getAll().then(existingRecords => {
								const keysToDelete = this.cacheStrategy.prepare(newRecord, existingRecords);
								const deletePromises = keysToDelete.map(keyPath => this.newQuery(objectStore).delete(keyPath));
								Promise.all(deletePromises).then(() => {
									put(newRecord, key).then(() => resolve()).catch(e => reject(e));
								}).catch(() => reject());
							});
						});
					} else {
						put(newRecord, key).then(() => resolve()).catch(e => reject(e));
					}
				});
			},
			index: (name: string): ICollectionIndex<TCollectionSchema> => {
				return {
					get: (key: any[]) => new Promise((resolve, reject) => {
						const request = objectStore.index(name).get(key);
						request.onsuccess = () => {
							resolve(request.result);
						};
						request.onerror = () => {
							reject();
						};
					}),
					delete: (key: any[]) => new Promise<void>((resolve, reject) => {
						const keyRangeValue = IDBKeyRange.only(key);
						objectStore.index(name).openCursor(keyRangeValue).onsuccess = function(event) {
							const cursor = (<IndexedDBEventTarget> event.target).result;
							if (cursor) {
								const request = cursor.delete();
								request.onsuccess = () => cursor.continue();
								request.onerror = () => reject();
							} else {
								resolve();
							}
						};
					})
				};
			},
			get: (key: any[]):  Promise<TCollectionSchema> => {
				return new Promise((resolve, reject) => {
					const request = objectStore.get(key);

					request.onsuccess = (e) => {
						if (!request.result) {
							reject();
							return;
						}
						resolve(request.result);
					};
					request.onerror = (e) => {
						reject();
					}
				});
			},
			getAll: (): Promise<TCollectionSchema[]> => {
				return new Promise(resolve => {
					const data: TCollectionSchema[] = [];
						objectStore.openCursor().onsuccess = (e) => {
						const cursor = (<IndexedDBEventTarget> e.target).result;

						if (cursor) {
							data.push(cursor.value);
							cursor.continue();
						} else {
							resolve(data);
						}
					}
				});
			},
			getAllKeys: (): Promise<any[][]> => {
				return new Promise<any[][]>((resolve, reject) => {
					const request = objectStore.getAllKeys();
					request.onsuccess = () => resolve((<any[][]> request.result));
					request.onerror = () => reject();
				});
			},
			delete: (key: any[]): Promise<void> => {
				return new Promise<void>((resolve, reject) => {
					this.newQuery(objectStore).get(key).then(recordToDelete => {
						const request = objectStore.delete(key);
						request.onsuccess = (event) => {
							this.triggers.filter(trigger => trigger.action === CollectionTriggerAction.Delete).forEach(trigger => trigger.callbackFunction(recordToDelete));
							resolve();
						};
						request.onerror = () => reject();
					}).catch(() => resolve());
				});
			}
		}
	}

	public addTrigger(newTrigger: ICollectionTrigger<TCollectionSchema>) {
		this.triggers.push(newTrigger);
	}

	private getObjectStore(transaction: IDBTransaction) {
		return this.driver.getObjectStore(this.objectStoreName, transaction);
	}
}

export class IndexedDBDriver implements IStorageDriver {
	private IDB: IDBDatabase;
	private opened: boolean;
	private readonly dbName: string;
	private readonly dbVersion: number;

	private onDBOpenResolveCallbacks: any[] = [];
	private onDBOpenRejectCallbacks: any[] = [];

	private objectStores: IndexedDBObjectStore<any>[] = [];

	private failedToOpen: Boolean = false;

	constructor(name: string, version: number) {
		this.opened = false;
		this.dbName = name;
		this.dbVersion = version;
	}

	public open() {
		let openRequest = undefined;
		try {
			openRequest = window.indexedDB.open(this.dbName, parseInt(`${this.dbVersion}`));
		} catch (e) {
			this.reportOpenErrorCallbacks(e);
			return;
		}
		openRequest.onsuccess = e => this.IDBOpenHandler(e);
		openRequest.onerror = e => {
			this.reportOpenErrorCallbacks(e);
		};
		openRequest.onupgradeneeded = e => this.IDBUpgradeHandler(e);
	}

	private reportOpenErrorCallbacks(e) {
		this.failedToOpen = true;
		this.onDBOpenRejectCallbacks.forEach(reject => reject(e));
		this.onDBOpenRejectCallbacks.length = 0;
	}

	public getIDBInstance(): IDBDatabase {
		return this.IDB;
	}

	public isOpened(): boolean {
		return this.opened;
	}

	public onDBOpen() {
		return new Promise((resolve, reject) => {
			this.onDBOpenResolveCallbacks.push(resolve);
			this.onDBOpenRejectCallbacks.push(reject);
		});
	}

	public importCollection<TCollectionSchema>(objectStore: IndexedDBObjectStore<TCollectionSchema>): void {
		this.objectStores.push(objectStore);
		objectStore.setDriver(this);
	}

	public getCollection<TCollectionSchema>(collectionName): IStorageCollection<TCollectionSchema> {
		return this.objectStores.find(objectStore => objectStore.getName() === collectionName);
	}

	public transaction(objectStoreNames: string[]): IStorageTransaction {
		const transaction = this.IDB.transaction(objectStoreNames, 'readwrite');
		return {
			query: collectionName => this.query(collectionName, transaction)
		};
	}

	public getObjectStore(name: string, transaction?: IDBTransaction) {
		transaction = transaction || this.IDB.transaction(name, 'readwrite');
		return transaction.objectStore(name);
	}

	public query(collectionName, transaction?: IDBTransaction) {
		const collection = this.objectStores.find(objectStore => objectStore.getName() === collectionName);
		if (!collection) {
			throw `[IndexedDBDriver] Collection "${collectionName}" doesn't exist in storage "${this.dbName}"`;
		}

		return collection.newQuery(this.getObjectStore(collectionName, transaction));
	}

	private IDBOpenHandler(e) {
		this.IDB = (<IndexedDBEventTarget> e.target).result;
		this.opened = true;
		this.onDBOpenResolveCallbacks.forEach(resolve => resolve());
		this.onDBOpenResolveCallbacks.length = 0;
	}

	private IDBUpgradeHandler(e) {
		this.IDB = (<IndexedDBEventTarget> e.target).result;
		this.objectStores.forEach(objectStore => {
			if (!objectStore.isCreated()) {
				objectStore.create();
			}
			objectStore.updateIndexes(e.target.transaction);
		});
	}

	public hasFailedToOpen() {
		return this.failedToOpen;
	}
}