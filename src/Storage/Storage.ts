import {LocalStorageDriver, LocalStorageObjectStore} from "./Drivers/LocalStorage";
import {IndexedDBDriver, IndexedDBObjectStore} from './Drivers/IndexedDB';
import {IPageRenderInstructionsCacheEntry} from "./Storage.head";
import {IArtCacheDataSchema, IArtTextCacheData} from "../TextCache/TextCache.head";
import {BasicLRUCacheStrategy} from "./CacheStrategies/BasicLRU";
import {ArtDataLRU} from "./CacheStrategies/ArtDataLRU";
import {bestStorageTypeAvailable, StorageType} from "./Tools";

export const TEXT_CACHE_MANAGER_LOCAL_STORAGE_KEY = 'FB3TextCacheManagerData';
export const PP_CACHE_LOCAL_STORAGE_KEY = 'FB3Reader1.0';

export const FB_READER_IDB_NAME = 'FB3ReaderDB';
export const PP_CACHE_IDB_OBJECT_NAME = 'FBReaderStore';
export const FB_READER_CACHE_STORE_IDB_OBJECT_NAME = 'FBTextCacheStore';
export const FB_MEDIA_CACHE_STORE_IDB_OBJECT_NAME = 'FBMediaCacheStore';

export const FB_READER_IDB_VERSION = 1008003;

const basicLRUForPPCacheCollection = () => {
	return new BasicLRUCacheStrategy(6, 'Time');
};

const artDataLRUForTextCacheManagerCollection = (AppVersion: string) => {
	return new ArtDataLRU(6, 10, 2, AppVersion);
};

const bestStorageType = bestStorageTypeAvailable();

export module FB3LocalStorageDriver {
	let FB3LocalStorageDriver: LocalStorageDriver = undefined;
	function initialize(AppVersion: string) {
		const textCacheManagerCollection = new LocalStorageObjectStore<IArtTextCacheData>(TEXT_CACHE_MANAGER_LOCAL_STORAGE_KEY, ['Key']);
		textCacheManagerCollection.useCacheStrategy(artDataLRUForTextCacheManagerCollection(AppVersion));

		const ppCacheCollection = new LocalStorageObjectStore<IPageRenderInstructionsCacheEntry>(PP_CACHE_LOCAL_STORAGE_KEY, ['Key']);
		ppCacheCollection.useCacheStrategy(basicLRUForPPCacheCollection());

		FB3LocalStorageDriver = new LocalStorageDriver();
		FB3LocalStorageDriver.importCollection(textCacheManagerCollection);
		FB3LocalStorageDriver.importCollection(ppCacheCollection);
		FB3LocalStorageDriver.open();
	}

	export function getDriver(AppVersion?: string): LocalStorageDriver {
		if (bestStorageType === StorageType.NoStorage) {
			throw "[FB3LocalStorageDriver] Can't get driver because this type of storage is not supported.";
		}

		if (!FB3LocalStorageDriver) {
			initialize(AppVersion);
		}
		return FB3LocalStorageDriver;
	}
}

export module FB3IndexedDBDriver {
	let FBIndexedDBDriver: IndexedDBDriver = undefined;
	function initialize() {
		const FBReaderStore = new IndexedDBObjectStore<IPageRenderInstructionsCacheEntry>(PP_CACHE_IDB_OBJECT_NAME, ['Key']);
		FBReaderStore.useCacheStrategy(basicLRUForPPCacheCollection());

		const FBTextCacheStore = new IndexedDBObjectStore<IArtCacheDataSchema>(FB_READER_CACHE_STORE_IDB_OBJECT_NAME, ['ArtKey', 'ChunkAlias']);
		FBTextCacheStore.createIndex('ArtKey, ChunkAlias', ['ArtKey', 'ChunkAlias']);
		FBTextCacheStore.createIndex('ArtKey', ['ArtKey']);

		const FBMediaCacheStore = new IndexedDBObjectStore<Blob>(FB_MEDIA_CACHE_STORE_IDB_OBJECT_NAME);

		FBIndexedDBDriver = new IndexedDBDriver(FB_READER_IDB_NAME, FB_READER_IDB_VERSION);
		FBIndexedDBDriver.importCollection(FBReaderStore);
		FBIndexedDBDriver.importCollection(FBTextCacheStore);
		FBIndexedDBDriver.importCollection(FBMediaCacheStore);
	}

	export function getDriver(): IndexedDBDriver {
		if (bestStorageType !== StorageType.IndexedDB) {
			throw "[FB3IndexedDBDriver] Can't get driver because this type of storage is not supported.";
		}

		if (!FBIndexedDBDriver) {
			initialize();
		}
		return FBIndexedDBDriver;
	}
}