module FB3TextCache {
	/**
	 * This class is responsible for manipulation cache chunks via querying to IndexedDB
	 */
	class TextCache implements FB3Storage.IFB3StorageCacheProvider {
		private readonly ObjectStoreName: string = 'FBTextCacheStore';
		private readonly ArtKey: string;
		private readonly ActiveTransaction: IDBTransaction;

		/**
		 * @param {FB3Storage.IndexedDBDriver} Driver - initialized IndexedDBDriver
		 * @param {string} ArtKey - key of required art's cache
		 * @param {IDBTransaction} ActiveTransaction - IndexedDB transaction, should be passed if we want to perform request using existing transaction
		 * @constructor
		 */
		constructor(private Driver: FB3Storage.IndexedDBDriver, ArtKey: string, ActiveTransaction?: IDBTransaction) {
			this.ArtKey = ArtKey;
			this.ActiveTransaction = ActiveTransaction;
		}

		/**
		 * Saves chunk data (and some custom data) to IndexedDB
		 * @param {string} ChunkAlias
		 * @param ChunkData
		 * @param ChunkCustomData
		 * @param {Function} Callback - function called after successful saving
		 */
		public SaveChunk(ChunkAlias: string, ChunkData: any, ChunkCustomData: any, Callback = () => {}, FailureCallback = () => {}) {
			const Data = {
				ArtKey: this.ArtKey,
				ChunkAlias: ChunkAlias,
				Data: ChunkData,
				CustomData: ChunkCustomData
			};
			this.Driver.SaveData(this.ObjectStoreName, ChunkAlias, Data, null, Callback, FailureCallback);
		}

		/**
		 * Retrieves chunk data (and some custom data) from IndexedDB
		 * @param {string} ChunkAlias
		 * @param {Function} Callback - function called after data retrieved successfully
		 * @param {Function} FailureCallback - function called when some problem occured while trying to retrieve data
		 */
		public GetChunk(ChunkAlias: string, Callback = (data: any, customData: any) => {}, FailureCallback: Function = () => {}) {
			this.Driver.Index(this.ObjectStoreName, 'ArtKey, ChunkAlias', [this.ArtKey, ChunkAlias], (res) => {
				if (res) {
					Callback(res.Data, res.CustomData);
					return;
				}
				FailureCallback();
			}, FailureCallback);
		}

		/**
		 * Deletes all records of chunks from IndexedDB with current ArtKey
		 * @param Callback
		 */
		public Clear(Callback: Function = () => {}) {
			this.Filter(({value: {ArtKey}}) => ArtKey !== this.ArtKey, Callback);
		}

		/**
		 * Delete a record of chunks that does not satisfy the filter function
		 * @param {Function} FilterFunction - should return true if element have to stay in store, otherwise false
		 * @param {Function} Callback
		 */
		public Filter(FilterFunction: (elem: any) => boolean, Callback: Function = (transaction: IDBTransaction) => {}) {
			this.Driver.Filter(this.ObjectStoreName, FilterFunction, Callback, this.ActiveTransaction);
		}
	}

	/**
	 * This class handles connection between DataProvider and TextCache in order to sor information about cached chunks of multiple arts
	 * We store chunk cache in IndexedDB and have information of all cached chunks in localstorage
	 */
	export class TextCacheManager {
		private LocalStorageDriver: FB3Storage.LocalStorageDriver;
		private IndexedDBDriver: FB3Storage.IndexedDBDriver;
		private readonly LocalStorageKey: string = 'FB3TextCacheManagerData';

		constructor() {
			this.LocalStorageDriver = new FB3Storage.LocalStorageDriver(this, 6, this.OnLRUClearedHandler.bind(this));
			this.IndexedDBDriver = new FB3Storage.IndexedDBDriver(this);
		}

		public Use(SuccessCallback = () => {}, FailureCallback = () => {}) {
			if (this.IndexedDBDriver.InitFailed === true) {
				FailureCallback();
				return;
			}
			if (this.IndexedDBDriver.IsReady === false) {
				this.IndexedDBDriver.OnReadyCallback = SuccessCallback;
				this.IndexedDBDriver.OnInitErrorCallback = FailureCallback;
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
			const ChunkFileName = TextCacheManager.GetFileNameFromURL(ChunkURL);
			// searching for current art
			this.LocalStorageDriver.Find(this.LocalStorageKey, ArtKey, (data: any) => {
				const artTextCacheData: IArtTextCacheData = data || {
					Key: ArtKey,
					ObjectStoreName: ArtKey,
					Chunks: {}
				};

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
			});
		}

		/**
		 * Loads chunk data from IndexedDB
		 * @param {string} ArtKey
		 * @param {string} ChunkURL
		 * @param {Function} Callback - will be called in any case, either with data, or with null if cache is not found
		 */
		public LoadChunkData(ArtKey: string, ChunkURL: string, Callback = (data, customData) => {}) {
			const ChunkFileName = TextCacheManager.GetFileNameFromURL(ChunkURL);
			this.LocalStorageDriver.Find(this.LocalStorageKey, ArtKey, (data: any) => {
				// check if we have such object
				if (data && data.Chunks[ChunkFileName] && (data.Chunks[ChunkFileName].Cached === true)) {
					new TextCache(this.IndexedDBDriver, data.ObjectStoreName).GetChunk(data.Chunks[ChunkFileName].Key, Callback, () => {
						// there was some error retrieving this file, we should mark it as uncached, and then Callback() like there was no file
						data.Chunks[ChunkFileName].Cached = false;
						this.RefreshLocalStorageDriver(ArtKey, data, () => {
							Callback(null, null);
						});
					});
				} else {
					Callback(null, null);
				}
			});
		}

		public SaveMediaData(ArtKey: string, MediaURL: string, MediaData: Blob, Callback = () => {}){
			const MediaFileName = TextCacheManager.GetFileNameFromURL(MediaURL);
			this.LocalStorageDriver.Find(this.LocalStorageKey, ArtKey, (artTextCacheData: IArtTextCacheData) => {
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

				new FB3MediaCache.MediaCache(this.IndexedDBDriver, String(ArtKey)).SaveMediaItem(MediaFileName, MediaData, () => {
					artTextCacheData.Media[MediaFileName].Cached = true;
					this.RefreshLocalStorageDriver(ArtKey, artTextCacheData, Callback);
				});
			});
		}

		public LoadMediaData(ArtKey: string, MediaURL: string, Callback = (data) => {} ) {
			const MediaFileName = TextCacheManager.GetFileNameFromURL(MediaURL);
			this.LocalStorageDriver.Find(this.LocalStorageKey, ArtKey, (data: any) => {
				// check if we have such object

				if (data && data.Media && data.Media[MediaFileName] && (data.Media[MediaFileName].Cached === true)) {
					new FB3MediaCache.MediaCache(this.IndexedDBDriver, data.ObjectStoreName).GetMediaItem(data.Media[MediaFileName].Key, Callback, () => {
						// there was some error retrieving this file, we should mark it as uncached, and then Callback() like there was no file
						data.Media[MediaFileName].Cached = false;
						this.RefreshLocalStorageDriver(ArtKey, data, () => {
							Callback(null);
						});
					});
				} else {
					Callback(null);
				}
			});
		}

		public static GetFileNameFromURL(URL: string): string {
			return URL.split(/[?#]/)[0].match(/[^\/]+$/)[0];
		}

		public static GetStorageKey(BaseUrl: string): string {
			return `${BaseUrl}:${AppVersion}`;
		}

		public static NoCacheURL(URL: string): string {
			URL += (URL.split('?')[1] ? '&':'?') + 'cachev=' + Number(new Date());
			return URL;
		}

		private static FindTOCFilename(ArrayOfFilenames: string[]): string | null {
			for (let i = 0; i < ArrayOfFilenames.length; i++) {
				if (ArrayOfFilenames[i].indexOf('toc.js') >= 0) {
					return ArrayOfFilenames[i];
				}
			}
			return null;
		}

		private SaveChunkWrapper(ArtKey: string, ChunkFileName: string, ChunkData: any, ChunkCustomData: any, artTextCacheData: IArtTextCacheData, Callback) {
			new TextCache(this.IndexedDBDriver, String(ArtKey)).SaveChunk(ChunkFileName, ChunkData, ChunkCustomData, () => {
				artTextCacheData.Chunks[ChunkFileName].Cached = true;
				this.IsArtFullCached(ArtKey, isFullCached => {
					artTextCacheData.FullCached = isFullCached;
					this.RefreshLocalStorageDriver(ArtKey, artTextCacheData, Callback);
				});
			}, Callback);
		}

		private IsArtFullCached(ArtKey: string, Callback: Function = () => {}) {
			this.LocalStorageDriver.Find(this.LocalStorageKey, ArtKey, (artTextCacheData: IArtTextCacheData) => {
				const tocFilename = TextCacheManager.FindTOCFilename(Object.keys(artTextCacheData.Chunks));
				const cachedChunks = Object.keys(artTextCacheData.Chunks).filter(ChunkAlias => artTextCacheData.Chunks[ChunkAlias].Cached === true && ChunkAlias !== tocFilename);
				new TextCache(this.IndexedDBDriver, artTextCacheData.ObjectStoreName).GetChunk(artTextCacheData.Chunks[tocFilename].Key, (dataTOC) => {
					Callback(dataTOC.Parts && (cachedChunks.length === Object.keys(dataTOC.Parts).length));
				}, () => {
					Callback(false);
				});
			});
		}

		private WipeCachedItems(ArtKey, Callback) {
			this.LocalStorageDriver.Find(this.LocalStorageKey, ArtKey, (data: any) => {
				if (data) {
					const transaction = this.IndexedDBDriver.CreateTransaction(['FBTextCacheStore', 'FBMediaCacheStore']);
					new TextCache(this.IndexedDBDriver, data.ObjectStoreName, transaction).Clear((transaction: IDBTransaction) => {
						new FB3MediaCache.MediaCache(this.IndexedDBDriver, data.ObjectStoreName, transaction).Clear(() => {
							for (let ChunkKey in data.Chunks) {
								data.Chunks[ChunkKey].Cached = false;
							}
							for (let MediaKey in data.Media) {
								data.Media[MediaKey].Cached = false;
							}
							this.RefreshLocalStorageDriver(ArtKey, data, Callback)
						});
					});
				}
			});
		}

		/**
		 * Handler for localstorage LRU logic, will delete given arts cache data from IndexedDB
		 * @param ArrayOfClearedArts
		 */
		private OnLRUClearedHandler(ArrayOfClearedArts: Array<IArtTextCacheData> = []) {
			// our LocalStorageDriver removed some references to object - we should clear their object stores from IndexedDB
			ArrayOfClearedArts.forEach((clearedArt) => {
				const transaction = this.IndexedDBDriver.CreateTransaction(['FBTextCacheStore', 'FBMediaCacheStore']);
				new TextCache(this.IndexedDBDriver, clearedArt.ObjectStoreName, transaction).Clear((transaction: IDBTransaction) => {
					new FB3MediaCache.MediaCache(this.IndexedDBDriver, clearedArt.ObjectStoreName, transaction).Clear();
				});
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
			this.LocalStorageDriver.LoadData(this.LocalStorageKey, (res) => {
				this.LocalStorageDriver.SaveData(this.LocalStorageKey, ArtKey, NewData, res, Callback);
			});
		}
	}
}