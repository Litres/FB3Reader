/**
 * FictionBook Reader Storage Main Concepts
 * This file contains all interfaces that could be implemented in order to provide support for a new type of storage
 *
 * Any storage could be accessed by it's StorageDriver.
 * StorageDriver can provide access to storage collections (e.g. tables or store objects).
 * Collections themselves could have indexes, triggers and cache strategies.
 */

/**
 * CollectionIndex is formed by ordered list of collections attributes and has a name.
 * Collections could be unique or non-unique, their main aim is to provide search functionality for collection.
 */
export interface ICollectionIndex<TCollectionSchema> {
	get(key: any[]): Promise<TCollectionSchema>;	// resolves with first occurrence of record that matches the given key or rejects if no such record found
	delete(key: any[]): Promise<void>;	// deletes record that matches the given key, resolves in any case
}

/**
 * CollectionQuery makes it possible to perform various operations on records of StorageCollection
 * CollectionQuery should be created using StorageDriver's query() method.
 * CollectionQuery should also be able to perform queries in one transaction (if storage itself supports transactions)
 */
export interface ICollectionQuery<TCollectionSchema> {
	get(primaryKey: any[]): Promise<TCollectionSchema>;	// resolves if record with primaryKey given, otherwise rejects
	delete(primaryKey: any[]): Promise<void>;	// deletes record that matches the given primaryKey
	put(value: TCollectionSchema, key?: any[]): Promise<void>;	// if record matches some of unique records updates it, otherwise inserts new record (out-of-line key could be provided using key argument)
	getAll(): Promise<TCollectionSchema[]>;	// always resolves with array of records (array could be empty)
	getAllKeys(): Promise<any[][]>;	// always resolves with array of out-of-line keys (array could be empty)
	index(name: string): ICollectionIndex<TCollectionSchema>;	// returns ICollectionIndex implementation of index with given name
}

/**
 * Any kind of instance that supports query method (e.g. StorageDriver or StorageTransaction)
 */
export interface IQueryable<TCollectionSchema> {
	query(collection: string): ICollectionQuery<TCollectionSchema>;	// returns ICollectionQuery implementation
}

/**
 * StorageTransaction provides possibility to perform number of queries in one StorageDriver within on transactions
 * Only requirement for StorageTransaction is to has query method
 */
export interface IStorageTransaction extends IQueryable<any>{}

/**
 * CacheStrategy provides functionality of removing records based on some cache strategy (e.g. LRU)
 * CacheStrategy can be used on StorageCollection, each StorageCollection can have only one CacheStrategy
 * CacheStrategy can be used only on StorageCollections which have primaryKey set
 */
export interface ICacheStrategy<TCollectionSchema> {
	prepare(newRecord: TCollectionSchema, existingRecords: TCollectionSchema[]): string[][];	// this method is called before inserting new record to the collection, array of keys to remove should be returned
	setUniqueKeyPath(keyPath: string[]): void;	// should be used to provide primaryKey path of current StorageCollection
}

/**
 * Triggers could react on different types of actions, here is the list of these types
 */
export enum CollectionTriggerAction {
	Put,
	Insert,
	Delete
}

/**
 * CollectionTrigger is a special procedure that is stored in StorageCollection instance
 * When some kind of action is performed on given StorageCollection, appropriate callbackFunction is called with target record as an argument
 */
export interface ICollectionTrigger<TCollectionSchema> {
	action: CollectionTriggerAction,	// type to action to listen to
	callbackFunction: (record: TCollectionSchema) => void;	// function to call after action has happened
}


/**
 * StorageCollection represents any kind of instance with stores records (e.g. tables in SQL, ObjectStores in IndexedDB)
 * StorageCollections are imported in StorageDriver and are accessing within it
 */
export interface IStorageCollection<TCollectionSchema> {
	setDriver(driver: IStorageDriver);	// set corresponding StorageDriver entity (method should be called inside StorageDriver)
	createIndex(name: string, path: string[]);	// creates new CollectionIndex within this collection
	initialize(): void;	// performs all necessary actions to initialize StorageCollection (should be done every StorageDriver opening)
	create(): void; // creates storage collection if doesn't exists (or throw an error)
	getName(): string;	// returns name of this collection
	newQuery(collectionReference?: any): ICollectionQuery<TCollectionSchema>;	// returns new CollectionQuery instance with given ir new collectionReference
	useCacheStrategy(cacheStrategy: ICacheStrategy<TCollectionSchema>): void;	// sets CacheStrategy for this StorageCollection if no strategy is set yet, otherwise throws an error
	addTrigger(newTrigger: ICollectionTrigger<TCollectionSchema>): void;	 // adds new CollectionTrigger to this collection
	isInitialized(): boolean;
	isCreated(): boolean;
}

/**
 * StorageDriver is the main entry in for using any storage
 * StorageDriver represents one particular database and mainly consists of StorageCollection entities
 */
export interface IStorageDriver {
	importCollection<TCollectionSchema>(collection: IStorageCollection<TCollectionSchema>): void;	// bind StorageCollection to this StorageDriver
	getCollection<TCollectionSchema>(collectionName: string): IStorageCollection<TCollectionSchema>;	// returns StorageCollection that matches given collectionName
	open(): void;	// opens Storage, performs all required setups
	query<TCollectionSchema>(collectionName: string): ICollectionQuery<TCollectionSchema>;	// returns new CollectionQuery on collection that matches given collectionName
	isOpened(): boolean;
}