import {
	IStorageCollection,
	IStorageDriver,
	ICollectionIndex,
	ICollectionQuery,
	ICacheStrategy,
	ICollectionTrigger, CollectionTriggerAction
} from "../index.head";

/**
 * In case of localStorage we consider localStorage items to be collections
 * Each localStorage item has a JSON string as a value
 * While this kind of Collections should be used for small amounts of data, we can optimize operations with data by storing the current state of collection in JavaScript
 */

const PRIMARY_INDEX_KEY = "PRIMARY";

interface LocalStorageIndex {
	name: string | undefined;
	unique: boolean;
	path: string[];
}

export class LocalStorageObjectStore<TCollectionSchema> implements IStorageCollection<TCollectionSchema> {
	private cacheStrategy: ICacheStrategy<TCollectionSchema>;
	private readonly storeName: string;
	private storeData: TCollectionSchema[] = null;
	private indexes: LocalStorageIndex[] = [];

	private triggers: ICollectionTrigger<TCollectionSchema>[] = [];

	constructor(storeName: string, primaryKeyPath?: string[]) {
		this.storeName = storeName;

		// if primaryKeyPath was added as parameter, just add it to our indexes array with unique=true
		if (primaryKeyPath) {
			this.indexes.push({
				unique: true,
				path: primaryKeyPath,
				name: PRIMARY_INDEX_KEY
			});
		}
	}

	public useCacheStrategy(cacheStrategy: ICacheStrategy<TCollectionSchema>): void {
		if (this.isInitialized()) {
			throw "[LocalStorageObjectStore] Unable to use cacheStrategy when collection is already initialized";
		}

		if (this.cacheStrategy) {
			throw "[LocalStorageObjectStore] Unable to use cacheStrategy when another cacheStrategy is being used";
		}

		const primaryKeyIndex = this.getIndexByName(PRIMARY_INDEX_KEY);
		if (!primaryKeyIndex) {
			throw `[LocalStorageObjectStore] Unable to use cacheStrategy without "${PRIMARY_INDEX_KEY}" key`;
		}

		this.cacheStrategy = cacheStrategy;
		this.cacheStrategy.setUniqueKeyPath(primaryKeyIndex.path);
	}

	public newQuery(): ICollectionQuery<TCollectionSchema> {
		return {
			index: (name: string): ICollectionIndex<TCollectionSchema> => {
				const index = this.getIndexByName(name);
				if (!index) {
					throw `[LocalStorageObjectStore] Index ${name} doesn't exists`;
				}

				return {
					get: (recordKey: any[]) => new Promise<TCollectionSchema>((resolve, reject) => {
						for (let record of this.storeData) {
							const hasCollision = index.path.reduce((res, key, i) => res && (record[key] === recordKey[i]), true);
							if (hasCollision) {
								resolve(record);
								return;
							}
						}
						reject();
					}),
					delete: (recordKey: any[]) => new Promise<void>((resolve, reject) => {
						let deletedRecords = [];
						for (let i = 0; i < this.storeData.length; i++) {
							const hasCollision = index.path.reduce((res, key, i) => res && (this.storeData[i][key] === recordKey[i]), true);
							if (hasCollision) {
								deletedRecords = deletedRecords.concat(this.storeData.splice(i, 1));
							}
						}
						this.setLocalStorageStoreItem();

						deletedRecords.forEach(deletedRecord => {
							this.triggers.filter(trigger => trigger.action === CollectionTriggerAction.Delete).forEach(trigger => trigger.callbackFunction(deletedRecord));
						});
						resolve();
					})
				}
			},
			put: (newRecord: TCollectionSchema): Promise<void> => {
				return new Promise<void>((resolve, reject) => {
					const onPut = () => {
						this.triggers.filter(trigger => trigger.action === CollectionTriggerAction.Put).forEach(trigger => trigger.callbackFunction(newRecord));
						this.setLocalStorageStoreItem();
						resolve();
					};

					const onInsert = () => {
						this.triggers.filter(trigger => trigger.action === CollectionTriggerAction.Insert).forEach(trigger => trigger.callbackFunction(newRecord));
					};

					const collidedElementPosition = this.getIndexCollision(newRecord);
					if (collidedElementPosition >= 0) {
						// record will be overwritten - no need to perform Cache Policy check
						this.storeData[collidedElementPosition] = newRecord;
						onPut();
						return;
					} else {
						// no such record - perform Cache Policy check
						if (this.cacheStrategy) {
							this.newQuery().getAll().then(existingRecords => {
								const keysToDelete = this.cacheStrategy.prepare(newRecord, existingRecords);
								const deletePromises = keysToDelete.map(keyPath => this.newQuery().delete(keyPath));
								Promise.all(deletePromises).then(() => {
									this.storeData.push(newRecord);
									onInsert();
									return;
								}).catch(() => reject());
							});
						} else {
							this.storeData.push(newRecord);
							onInsert();
							return;
						}
					}
				});
			},
			getAll: () => {
				return new Promise<TCollectionSchema[]>(resolve => {
					resolve(Object.assign(this.storeData));
				});
			},
			get: (key: any[]): Promise<TCollectionSchema> => {
				const primaryKeyIndex = this.getIndexByName(PRIMARY_INDEX_KEY);
				if (!primaryKeyIndex) {
					throw `[LocalStorageObjectStore] 'get' method is not available without "${PRIMARY_INDEX_KEY}" key`;
				}

				return this.newQuery().index(PRIMARY_INDEX_KEY).get(key);
			},
			getAllKeys: (): Promise<any[][]> => {
				const primaryKeyIndex = this.getIndexByName(PRIMARY_INDEX_KEY);
				if (!primaryKeyIndex) {
					throw `[LocalStorageObjectStore] 'getAllKeys' method is not available without "${PRIMARY_INDEX_KEY}" key`;
				}

				return new Promise<any[][]>(resolve => {
					const result: any[][] = [];
					for (let record of this.storeData) {
						result.push(primaryKeyIndex.path.map(key => record[key]));
					}
					resolve(result);
				});
			},
			delete: (key: any[]): Promise<void> => {
				const primaryKeyIndex = this.getIndexByName(PRIMARY_INDEX_KEY);
				if (!primaryKeyIndex) {
					throw `[LocalStorageObjectStore] 'delete' method is not available without "${PRIMARY_INDEX_KEY}" key`;
				}

				return this.newQuery().index(PRIMARY_INDEX_KEY).delete(key);
			}
		};
	}

	public createIndex(name: string, path: string[], unique = false) {
		if (name === PRIMARY_INDEX_KEY) {
			throw `[LocalStorageObjectStore] Index name "${PRIMARY_INDEX_KEY}" is reserved. Index "${PRIMARY_INDEX_KEY} could be created in constructor"`;
		}

		// TODO: add check for same paths
		this.indexes.push({unique, path, name});
	}

	public isCreated(): boolean {
		return localStorage.getItem(this.storeName) !== null;
	}

	public isInitialized(): boolean {
		return this.storeData !== null;
	}

	public create(): void {
		if (this.isCreated()) {
			throw `[LocalStorageObjectStore] Collection ${this.storeName} is created already`;
		}

		this.storeData = [];
		this.setLocalStorageStoreItem();
	}

	public initialize(): void {
		if (this.isInitialized()) {
			throw `[LocalStorageObjectStore] Collection ${this.storeName} is initialized already`;
		}

		this.storeData = this.getLocalStorageStoreItem();
	}

	public getName() {
		return this.storeName;
	}

	public setDriver(driver: IStorageDriver) {
		// empty - localStorage is a single driver which is automatically set
	}

	public addTrigger(newTrigger: ICollectionTrigger<TCollectionSchema>): void {
		this.triggers.push(newTrigger);
	}

	/**
	 * We have collections of objects and list of unique indexes. Here we check that there are no other records with the same combination of index path values for any of existing indexes
	 * @param recordToCheck
	 */
	private getIndexCollision(recordToCheck: TCollectionSchema): number {
		const uniqueIndexes = this.indexes.filter(index => index.unique === true);
		// for all uniqueIndexes
		for (let uniqueIndex of uniqueIndexes) {
			// for records in collection
			for (let i = 0; i < this.storeData.length; i++) {
				const hasCollision = uniqueIndex.path.reduce((res, key) => res || (this.storeData[i][key] === recordToCheck[key]), false);
				if (hasCollision) {
					return i;
				}
			}
		}

		return -1;
	}

	private getIndexByName(name: string): LocalStorageIndex  {
		return this.indexes.find(index => (index.name === name));
	}

	private getLocalStorageStoreItem(): TCollectionSchema[] {
		let result = [];
		try {
			result = JSON.parse(localStorage.getItem(this.storeName));
		} catch(e) {
			console.warn(`[LocalStorage] Error with reading store ${this.storeName}`, e);
		}
		return result;
	}

	private setLocalStorageStoreItem() {
		localStorage.setItem(this.storeName, JSON.stringify(this.storeData));
	}
}

export class LocalStorageDriver implements IStorageDriver {
	private collections: IStorageCollection<any>[] = [];
	private readonly opened: boolean = true;

	public importCollection<TCollectionSchema>(collection: IStorageCollection<TCollectionSchema>): void {
		this.collections.push(collection);
	}

	public getCollection<TCollectionSchema>(collectionName): IStorageCollection<TCollectionSchema> {
		return this.collections.find(collection => collection.getName() === collectionName);
	}

	public query<TCollectionSchema>(collectionName: string) {
		const collection: LocalStorageObjectStore<TCollectionSchema> = (<LocalStorageObjectStore<TCollectionSchema>> this.collections.find(collection => collection.getName() === collectionName));

		return collection.newQuery();
	}

	public isOpened() {
		return this.opened;
	}

	public open() {
		this.collections.forEach(collection => {
			if (!collection.isCreated()) {
				collection.create();
			}
			if (!collection.isInitialized()) {
				collection.initialize();
			}
		});
	}
}