module FB3MediaCache {
	/**
	 * This class is responsible for manipulation media (mainly images as blobs) via querying to IndexedDB
	 */
	export class MediaCache implements FB3Storage.IFB3StorageCacheProvider {
		private readonly ObjectStoreName: string = 'FBMediaCacheStore';
		private readonly ArtKey: string;
		private Driver: FB3Storage.IndexedDBDriver;
		private readonly ActiveTransaction: IDBTransaction;

		/**
		 * @param {FB3Storage.IndexedDBDriver} Driver - initialized IndexedDBDriver
		 * @param {string} ArtKey - key of required art's cache
		 * @param {IDBTransaction} ActiveTransaction - IndexedDB transaction, should be passed if we want to perform request using existing transaction
		 * @constructor
		 */
		constructor(Driver: FB3Storage.IndexedDBDriver, ArtKey: string, ActiveTransaction?: IDBTransaction) {
			this.Driver = Driver;
			this.ArtKey = ArtKey;
			this.ActiveTransaction = ActiveTransaction;
		}

		/**
		 * Saves media as blob (or as string if Blob Storage is not supported in IndexedDB) to IndexedDB
		 * @param {string} MediaItemAlias
		 * @param {Blob} MediaItemBlob
		 * @param {Function} Callback - function called after successful saving
		 */
		public SaveMediaItem(MediaItemAlias: string, MediaItemBlob: Blob, Callback = () => {}) {
			this.Driver.SaveBlobData(this.ObjectStoreName, [this.ArtKey, MediaItemAlias], MediaItemBlob, Callback);
		}

		/**
		 * Retrieves media as blob from IndexedDB
		 * @param {string} MediaItemAlias
		 * @param {Function} Callback - function called after data retrieved successfully
		 * @param {Function} FailureCallback - function called when some problem occurred while trying to retrieve data
		 */
		public GetMediaItem(MediaItemAlias: string, Callback = (data: Blob) => {}, FailureCallback: Function = () => {}) {
			this.Driver.Find(this.ObjectStoreName, [this.ArtKey, MediaItemAlias], (res) => {
				if (res) {
					Callback(res);
					return;
				}
				FailureCallback();
			});
		}

		/**
		 * Deletes all records of chunks from IndexedDB with current ArtKey
		 * @param Callback
		 */
		public Clear(Callback: Function = () => {}) {
			this.Filter((elem: IDBCursor) => elem.primaryKey[0] !== this.ArtKey, Callback);
		}

		/**
		 * Delete all media items that does not satisfy the filter function
		 * @param {Function} FilterFunction - should return true if element have to stay in store, otherwise false
		 * @param {Function} Callback
		 */
		public Filter(FilterFunction: (elem: IDBCursor) => boolean, Callback: Function = (transaction: IDBTransaction) => {}) {
			this.Driver.Filter(this.ObjectStoreName, FilterFunction, Callback, this.ActiveTransaction);
		}
	}

	export class MediaCacheLoader {
		private TextCacheManager: FB3TextCache.TextCacheManager;
		private ArtKey: string;
		private ActiveRequests: {[MediaSource: string]: {ElementID: string, InsertionRules: string}[]};

		constructor(TextCacheManager: FB3TextCache.TextCacheManager, BaseURL: string) {
			this.ArtKey = FB3TextCache.TextCacheManager.GetStorageKey(BaseURL);
			this.TextCacheManager = TextCacheManager;
			this.ActiveRequests = {};
		}

		/**
		 * Loads media given in MediaSource, and then insert it in element with id=ElementID according to InsertionRules
		 * Media will be loaded asynchronously and then inserted
		 * @param {string} ElementID - id of an element in DOM
		 * @param MediaSource - url to media
		 * @param InsertionRules - how should image source be inserted, supports 'src' for src attribute and 'style.background.url' for backgroundUrl in styles attribute
		 */
		public LoadImageAsync(ElementID: string, MediaSource: string, InsertionRules: string) {
			// if have multiple requests for one media source - we won't process all of them through IndexedDB
			// we will remember all these requests and then call ProcessBlobData on each (performing only one XHR/IndexedDB request instead of multiple)
			if (this.ActiveRequests[MediaSource]) {
				this.ActiveRequests[MediaSource].push({ElementID, InsertionRules});
				return;
			}
			this.ActiveRequests[MediaSource] = [];
			this.ActiveRequests[MediaSource].push({ElementID, InsertionRules});
			// if we can use text/media caching - just using it, otherwise normal xhr request
			this.TextCacheManager.Use(() => {
				this.TextCacheManager.LoadMediaData(this.ArtKey, MediaSource, (BlobData) => {
					if (BlobData) {
						this.OnMediaLoaded(MediaSource, BlobData);
					} else {
						this.LoadMediaSource(MediaSource, (BlobData) => {
							this.TextCacheManager.SaveMediaData(this.ArtKey, MediaSource, BlobData, () => {
								this.OnMediaLoaded(MediaSource, BlobData);
							});
						});
					}
				});
			}, () => {
				this.LoadMediaSource(MediaSource, (BlobData) => {
					this.OnMediaLoaded(MediaSource, BlobData);
				});
			});
		}

		private LoadMediaSource(MediaSource: string, SuccessCallback) {
			new AjaxDataProvider.AjaxLoader({
				URL: MediaSource,
				ResponseType: 'blob',
				SuccessCallback,
				FailureCallback: () => {console.warn(`${MediaSource} failed to load`)}
			}).PerformRequest();
		}

		private OnMediaLoaded(MediaSource, BlobData) {
			this.ActiveRequests[MediaSource].forEach(({ElementID, InsertionRules}) => {
				MediaCacheLoader.ProcessBlobData(ElementID, BlobData, InsertionRules);
			});
			delete this.ActiveRequests[MediaSource];
		}

		private static ProcessBlobData(ElementID: string, MediaData: Blob, InsertionRules: string) {
			const blobURL = window.URL.createObjectURL(MediaData);
			const targetElement = document.getElementById(ElementID);
			if (targetElement) {
				if (InsertionRules === 'style.background.url') {
					targetElement.style.background = `url(${blobURL}) no-repeat right center`;
					targetElement.style.backgroundSize = 'contain';
				} else if (InsertionRules === 'src') {
					targetElement.setAttribute('src', blobURL);
				}
			}
		}
	}
}