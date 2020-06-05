import {FB3MediaCache} from "../MediaCache/MediaCache";
import {IArtCacheDataSchema, IArtTextCacheData, ICachedArtSummary, ITextCacheManager} from './TextCache.head'
import {IFB3StorageCacheProvider} from "../Storage/Storage.head";

import {
	FB3IndexedDBDriver,
	FB3LocalStorageDriver,
	FB_MEDIA_CACHE_STORE_IDB_OBJECT_NAME,
	FB_READER_CACHE_STORE_IDB_OBJECT_NAME,
	TEXT_CACHE_MANAGER_LOCAL_STORAGE_KEY
} from "../Storage/Storage";
import {CollectionTriggerAction, IQueryable} from "../Storage/index.head";

module FB3TextCacheProvider {
	let textCacheManager: TextCacheManager = undefined;

	/**
	 * This class is responsible for manipulation cache chunks via querying to IndexedDB
	 */
	class TextCache implements IFB3StorageCacheProvider {
		private readonly ArtKey: string;
		private readonly QueryCreator: IQueryable<IArtCacheDataSchema>;

		/**
		 * @param QueryCreator
		 * @param {string} ArtKey - key of required art's cache
		 * @constructor
		 */
		constructor(QueryCreator: IQueryable<IArtCacheDataSchema>, ArtKey: string) {
			this.QueryCreator = QueryCreator;
			this.ArtKey = ArtKey;
		}

		private newQuery() {
			return this.QueryCreator.query(FB_READER_CACHE_STORE_IDB_OBJECT_NAME);
		}

		/**
		 * Saves chunk data (and some custom data) to IndexedDB
		 * @param {string} ChunkAlias
		 * @param ChunkData
		 * @param ChunkCustomData
		 * @param {Function} Callback - function called after successful saving
		 */
		public SaveChunk(ChunkAlias: string, ChunkData: any, ChunkCustomData: any, Callback = () => {}, FailureCallback = () => {}) {
			const Data: IArtCacheDataSchema = {
				ArtKey: this.ArtKey,
				ChunkAlias: ChunkAlias,
				Data: ChunkData,
				CustomData: ChunkCustomData
			};
			this.newQuery().put(Data)
				.then(() => Callback())
				.catch(() => FailureCallback());
		}

		/**
		 * Retrieves chunk data (and some custom data) from IndexedDB
		 * @param {string} ChunkAlias
		 * @param {Function} Callback - function called after data retrieved successfully
		 * @param {Function} FailureCallback - function called when some problem occured while trying to retrieve data
		 */
		public GetChunk(ChunkAlias: string, Callback = (data: any, customData: any) => {}, FailureCallback: Function = () => {}) {
			this.newQuery().index('ArtKey, ChunkAlias').get([this.ArtKey, ChunkAlias])
				.then(res => Callback(res.Data, res.CustomData))
				.catch(() => FailureCallback());
		}

		/**
		 * Deletes all records of chunks from IndexedDB with current ArtKey
		 * @param Callback
		 */
		public Clear(Callback: Function = () => {}) {
			this.newQuery().index('ArtKey').delete([this.ArtKey]).then(() => Callback());
		}
	}

	/**
	 * This class handles connection between DataProvider and TextCache in order to sort information about cached chunks of multiple arts
	 * We store chunk cache in IndexedDB and have information of all cached chunks in localstorage
	 */
	class TextCacheManager implements ITextCacheManager{
		private readonly AppVersion: string;
		private readonly insertedCollectionCallbacks = {};

		constructor(AppVersion: string) {
			this.AppVersion = AppVersion;
			FB3LocalStorageDriver.getDriver(this.AppVersion).getCollection(TEXT_CACHE_MANAGER_LOCAL_STORAGE_KEY).addTrigger({
				action: CollectionTriggerAction.Delete,
				callbackFunction: (deletedRecord: IArtTextCacheData) => this.onArtTextCacheDataDeleted(deletedRecord)
			});
			FB3LocalStorageDriver.getDriver(this.AppVersion).getCollection(TEXT_CACHE_MANAGER_LOCAL_STORAGE_KEY).addTrigger({
				action: CollectionTriggerAction.Insert,
				callbackFunction: (newRecord: IArtTextCacheData) => {
					const ArtKey = newRecord.Key;
					if (this.insertedCollectionCallbacks[ArtKey]) {
						this.insertedCollectionCallbacks[ArtKey].forEach(fn => fn());
					}
				}
			});
		}

		public Use(SuccessCallback = () => {}, FailureCallback = () => {}) {
			if (FB3IndexedDBDriver.getDriver().hasFailedToOpen()) {
				FailureCallback();
				return;
			} else if (!FB3IndexedDBDriver.getDriver().isOpened()) {
				FB3IndexedDBDriver.getDriver().onDBOpen()
					.then(() => SuccessCallback())
					.catch(() => FailureCallback());
				return;
			}

			SuccessCallback();
		}

		/**
		 * Saves chunk data to IndexedDB and updates manager data in localstorage
		 * This function should be called after data was retrieved from web
		 * @param {string} ArtKey
		 * @param {string} ChunkURL - relative URL (as in BaseUrl)
		 * @param ChunkData
		 * @param ChunkCustomData
		 * @param {Function} Callback - will be called after chunk data is successfully saved
		 */
		public SaveChunkData(ArtKey: string, ChunkURL: string, ChunkData: any, ChunkCustomData: any, Callback = () => {}) {
			const ChunkFileName = FB3TextCache.GetFileNameFromURL(ChunkURL);
			// searching for current art
			this.getArtTextCacheData(ArtKey).then((data: IArtTextCacheData) => {
				const artTextCacheData: IArtTextCacheData = data;

				if (!artTextCacheData.Chunks[ChunkFileName]) {
					artTextCacheData.Chunks[ChunkFileName] = {
						Key: ChunkFileName,
						Cached: false
					};
				}
				artTextCacheData.LastUsedTimestamp = +new Date();

				// at this moment we should update our localstorage so we will have initialized FB3TextCacheManagerData data
				this.RefreshLocalStorageDriver(ArtKey, artTextCacheData, () => {
					// if our fresh response is toc.js and we already have some data in cache, let's compare toc.js versions
					// if we got a newer version of toc.js, need to clear all cached items
					// in any other case act like usual
					if ((ChunkFileName.indexOf('toc.js') >= 0) && data) {
						this.LoadChunkData(ArtKey, ChunkURL, (dataTOC, dataTOCCustom) => {
							try {
								if (dataTOC.Meta.version !== ChunkData.Meta.version) {
									this.WipeCachedItems(ArtKey, () => this.SaveChunkWrapper(ArtKey, ChunkFileName, ChunkData, ChunkCustomData, artTextCacheData, Callback));
									return;
								}
								this.SaveChunkWrapper(ArtKey, ChunkFileName, ChunkData, ChunkCustomData, artTextCacheData, Callback);
							} catch (e) {
								this.SaveChunkWrapper(ArtKey, ChunkFileName, ChunkData, ChunkCustomData, artTextCacheData, Callback);
							}
						});
						return;
					}

					this.SaveChunkWrapper(ArtKey, ChunkFileName, ChunkData, ChunkCustomData, artTextCacheData, Callback);
				});
			}).catch(() => {});
		}

		/**
		 * Loads chunk data from IndexedDB
		 * @param {string} ArtKey
		 * @param {string} ChunkURL
		 * @param {Function} Callback - will be called in any case, either with data, or with null if cache is not found
		 */
		public LoadChunkData(ArtKey: string, ChunkURL: string, Callback = (data, customData) => {}) {
			const ChunkFileName = FB3TextCache.GetFileNameFromURL(ChunkURL);
			this.CreateTextCacheManagerQuery().get([ArtKey]).then((data: IArtTextCacheData) => {
				// check if we have such object
				if (data && data.Chunks[ChunkFileName] && (data.Chunks[ChunkFileName].Cached === true)) {
					new TextCache(FB3IndexedDBDriver.getDriver(), data.ObjectStoreName).GetChunk(data.Chunks[ChunkFileName].Key, Callback, () => {
						// there was some error retrieving this file, we should mark it as uncached, and then Callback() like there was no file
						data.Chunks[ChunkFileName].Cached = false;
						this.RefreshLocalStorageDriver(ArtKey, data, () => {
							Callback(null, null);
						});
					});
				} else {
					Callback(null, null);
				}
			}).catch(() => Callback(null, null));
		}

		public SaveMediaData(ArtKey: string, MediaURL: string, MediaData: Blob, Callback = (MediaFileName: string) => {}, FailureCallback = () => {}){
			const MediaFileName = FB3TextCache.GetFileNameFromURL(MediaURL);
			this.CreateTextCacheManagerQuery().get([ArtKey]).then((artTextCacheData: IArtTextCacheData) => {
				if (!artTextCacheData.Media) {
					artTextCacheData['Media'] = {};
				}
				if (!artTextCacheData.Media[MediaFileName]) {
					artTextCacheData.Media[MediaFileName] = {
						Key: MediaFileName,
						Cached: false
					}
				}
				artTextCacheData.LastUsedTimestamp = +new Date();

				new FB3MediaCache.MediaCache(FB3IndexedDBDriver.getDriver(), String(ArtKey)).SaveMediaItem(MediaFileName, MediaData, () => {
					artTextCacheData.Media[MediaFileName].Cached = true;
					this.RefreshLocalStorageDriver(ArtKey, artTextCacheData, () => Callback(MediaFileName));
				}, () => FailureCallback());
			});
		}

		public LoadMediaData(ArtKey: string, MediaURL: string, Callback = (data, storeFileName) => {} ) {
			const MediaFileName = FB3TextCache.GetFileNameFromURL(MediaURL);
			this.CreateTextCacheManagerQuery().get([ArtKey]).then((data: IArtTextCacheData) => {
				// check if we have such object
				if (data && data.Media && data.Media[MediaFileName] && (data.Media[MediaFileName].Cached === true)) {
					new FB3MediaCache.MediaCache(FB3IndexedDBDriver.getDriver(), data.ObjectStoreName).GetMediaItem(data.Media[MediaFileName].Key, (data) => Callback(data, MediaFileName), () => {
						// there was some error retrieving this file, we should mark it as uncached, and then Callback() like there was no file
						data.Media[MediaFileName].Cached = false;
						this.RefreshLocalStorageDriver(ArtKey, data, () => {
							Callback(null, null);
						});
					});
				} else {
					Callback(null, null);
				}
			}).catch(() => Callback(null, null));
		}

		public GetStorageKey(BaseUrl: string): string {
			return `${BaseUrl}:${this.AppVersion}`;
		}

		/**
		 * Adds all the default metadata required
		 * @param {string} ArtKey
		 * @param {number} ArtId
		 * @param {boolean} IsFullVersion
		 * @param {string} CacheReason
		 */
		public InitializeTextCacheData(ArtKey: string, ArtId: number, IsFullVersion: boolean, CacheReason: string) {
			const defaultArtTextCacheData: IArtTextCacheData = {
				Key: ArtKey,
				ObjectStoreName: `${ArtKey}`,
				FullCached: false,
				Chunks: {},
				Media: {},
				ArtId: ArtId,
				IsFullVersion: IsFullVersion,
				CacheReason: CacheReason,
				LastUsedTimestamp: null,
				MediaStorageMarkers: {},
				ReaderVersion: this.AppVersion
			};

			let artTextCacheData: IArtTextCacheData;

			const fillDataAndRefresh = () => {
				for (let key in defaultArtTextCacheData) {
					if (artTextCacheData[key] === undefined) {
						artTextCacheData[key] = defaultArtTextCacheData[key];
					}
				}
				this.RefreshLocalStorageDriver(ArtKey, artTextCacheData);
			};

			// Мы расширяем текщий объект, добавляя новые данные
			this.CreateTextCacheManagerQuery().get([ArtKey]).then((data: IArtTextCacheData) => {
				artTextCacheData = data;
				fillDataAndRefresh();
			}).catch(() => {
				artTextCacheData = defaultArtTextCacheData;
				fillDataAndRefresh();
			});
		}

		public AddMediaStorageMarker(ArtKey: string, MediaFileName: string, Marker: string) {
			this.CreateTextCacheManagerQuery().get([ArtKey]).then((data: IArtTextCacheData) => {
				data.MediaStorageMarkers[Marker] = MediaFileName;

				this.RefreshLocalStorageDriver(ArtKey, data);
			}).catch(() => console.error("Can't set marker if data is missing"));
		}

		private SaveChunkWrapper(ArtKey: string, ChunkFileName: string, ChunkData: any, ChunkCustomData: any, artTextCacheData: IArtTextCacheData, Callback) {
			new TextCache(FB3IndexedDBDriver.getDriver(), String(ArtKey)).SaveChunk(ChunkFileName, ChunkData, ChunkCustomData, () => {
				artTextCacheData.Chunks[ChunkFileName].Cached = true;
				this.IsArtFullCached(ArtKey, isFullCached => {
					artTextCacheData.FullCached = isFullCached;
					this.RefreshLocalStorageDriver(ArtKey, artTextCacheData, Callback);
				});
			}, Callback);
		}

		private IsArtFullCached(ArtKey: string, Callback: Function = () => {}) {
			this.CreateTextCacheManagerQuery().get([ArtKey]).then((artTextCacheData: IArtTextCacheData) => {
				const tocFilename = FB3TextCache.FindTOCFilename(Object.keys(artTextCacheData.Chunks));
				const cachedChunks = Object.keys(artTextCacheData.Chunks).filter(ChunkAlias => artTextCacheData.Chunks[ChunkAlias].Cached === true && ChunkAlias !== tocFilename);
				new TextCache(FB3IndexedDBDriver.getDriver(), artTextCacheData.ObjectStoreName).GetChunk(artTextCacheData.Chunks[tocFilename].Key, (dataTOC) => {
					Callback(dataTOC.Parts && (cachedChunks.length === Object.keys(dataTOC.Parts).length));
				}, () => {
					Callback(false);
				});
			});
		}

		private WipeCachedItems(ArtKey, Callback) {
			this.CreateTextCacheManagerQuery().get([ArtKey]).then((data: IArtTextCacheData) => {
				const transaction = this.CreateTransaction();
				new TextCache(transaction, data.ObjectStoreName).Clear(() => {
					new FB3MediaCache.MediaCache(transaction, data.ObjectStoreName).Clear(() => {
						for (let ChunkKey in data.Chunks) {
							data.Chunks[ChunkKey].Cached = false;
						}
						for (let MediaKey in data.Media) {
							data.Media[MediaKey].Cached = false;
						}
						this.RefreshLocalStorageDriver(ArtKey, data, Callback)
					});
				});
			}).catch(() => {});
		}

		/**
		 * Handler for localstorage LRU logic, will delete given arts cache data from IndexedDB
		 * @param deletedRecord
		 */
		private onArtTextCacheDataDeleted(deletedRecord: IArtTextCacheData) {
			const transaction = this.CreateTransaction();
			new TextCache(transaction, deletedRecord.ObjectStoreName).Clear(() => {
				new FB3MediaCache.MediaCache(transaction, deletedRecord.ObjectStoreName).Clear();
			});
		}

		/**
		 * Saves new information to localstorage
		 * Method should be called after each modification of FB3TextCacheManagerData
		 * @param {string} ArtKey
		 * @param NewData
		 * @param {Function} Callback
		 */
		private RefreshLocalStorageDriver(ArtKey, NewData, Callback: Function = () => {}) {
			const dataToSave = Object.assign(NewData);
			this.CreateTextCacheManagerQuery().put(dataToSave).then(() => Callback());
		}

		private getArtTextCacheData(ArtKey: string) {
			return new Promise((resolve, reject) => {
				this.CreateTextCacheManagerQuery().get([ArtKey])
					.then((data: IArtTextCacheData) => resolve(data))
					.catch(() => {
						this.insertedCollectionCallbacks[ArtKey] = this.insertedCollectionCallbacks[ArtKey] || [];
						this.insertedCollectionCallbacks[ArtKey].push(() => this.getArtTextCacheData(ArtKey).then((data: IArtTextCacheData) => resolve(data)));
					});
			})
		}

		private CreateTextCacheManagerQuery = () => FB3LocalStorageDriver.getDriver(this.AppVersion).query(TEXT_CACHE_MANAGER_LOCAL_STORAGE_KEY);
		private CreateTransaction = () => {
			const driver = FB3IndexedDBDriver.getDriver();
			return FB3IndexedDBDriver.getDriver().transaction([FB_READER_CACHE_STORE_IDB_OBJECT_NAME, FB_MEDIA_CACHE_STORE_IDB_OBJECT_NAME]);
		}
	}

	export function getTextCacheManager(AppVersion?): ITextCacheManager {
		if (!textCacheManager) {
			textCacheManager = new TextCacheManager(AppVersion);
		}

		return textCacheManager;
	}
}

export module FB3TextCache {
	export function getTextCacheManager(AppVersion): ITextCacheManager {
		return FB3TextCacheProvider.getTextCacheManager(AppVersion);
	}

	/**
	 * This method gathers all data about cached arts (meta and cover), resolves with array of ICachedArtSummary objects
	 */
	export function getCachedArtsSummary(AppVersion: string): Promise<ICachedArtSummary[]> {
		const textCacheManager = FB3TextCacheProvider.getTextCacheManager();
		const localStorageDriver = FB3LocalStorageDriver.getDriver(AppVersion);

		// metadata taken from toc.js chunk
		const getArtTOCData = (ArtKey: string, TOCChunkUrl: string) => new Promise(resolve => {
			textCacheManager.LoadChunkData(ArtKey, TOCChunkUrl, (data) => {
				resolve({
					meta: {
						title: data.Meta.Title,
						authors: data.Meta.Authors
					}
				});
			});
		});

		const getArtCoverImage = (ArtKey: string, CoverImageChunkKey) => new Promise(resolve => {
			textCacheManager.LoadMediaData(ArtKey, CoverImageChunkKey, (data) => {
				resolve({
					media: {
						coverImage: data
					}
				});
			});
		});

		return new Promise((resolve, reject) => {
			textCacheManager.Use(() => {
				// first of all, take all art cache objects
				localStorageDriver.query(TEXT_CACHE_MANAGER_LOCAL_STORAGE_KEY).getAll().then((caches: IArtTextCacheData[]) => {
					const cachedArtPromises = [];
					for (let cache of caches) {
						cachedArtPromises.push(new Promise(resolve => {
							// for each cache object we add basic info (trial, id, etc.)
							const result: ICachedArtSummary = {
								id: cache.ArtId,
								isFullVersion: cache.IsFullVersion,
								isFullCached: cache.FullCached,
								cacheReason: cache.CacheReason
							};
							// but there is also some data which need to be retrieved async (as metadata and cover), so we add promises
							const promises = [];
							if (cache.Chunks) {
								const tocKey = Object.keys(cache.Chunks).find(s => /toc\.js/.test(s));
								const tocChunkKey = cache.Chunks[tocKey].Key;
								promises.push(getArtTOCData(cache.Key, tocChunkKey));
							}

							if (cache.Media) {
								const coverKey = cache.MediaStorageMarkers && cache.MediaStorageMarkers['art_cover'];
								if (coverKey) {
									const coverImageChunkKey = cache.Media[coverKey].Key;
									promises.push(getArtCoverImage(cache.Key, coverImageChunkKey));
								}
							}

							// we resolve promises of our async pieces of data, and add parts to result object
							Promise.all(promises).then(data => {
								for (let obj of data) {
									for (let key in obj) {
										if (obj.hasOwnProperty(key)) {
											result[key] = Object.assign(obj[key]);
										}
									}
								}
								resolve(result);
							});
						}));
					}

					Promise.all(cachedArtPromises).then(data => {
						resolve(data);
					});
				});
			}, () => {});
		});
	}

	export function GetFileNameFromURL(URL: string): string {
		return URL.split(/[?#]/)[0].match(/[^\/]+$/)[0];
	}

	export function NoCacheURL(URL: string): string {
		URL += (URL.split('?')[1] ? '&':'?') + 'cachev=' + Number(new Date());
		return URL;
	}

	export function FindTOCFilename(ArrayOfFilenames: string[]): string | null {
		for (let i = 0; i < ArrayOfFilenames.length; i++) {
			if (ArrayOfFilenames[i].indexOf('toc.js') >= 0) {
				return ArrayOfFilenames[i];
			}
		}
		return null;
	}
}