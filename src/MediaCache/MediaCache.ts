import {IFB3StorageCacheProvider} from "../Storage/Storage.head";
import {FB3TextCache} from "../TextCache/TextCache";
import {AjaxDataProvider} from "../DataProvider/FB3AjaxDataProvider";
import {FB_MEDIA_CACHE_STORE_IDB_OBJECT_NAME} from "../Storage/Storage";
import {IQueryable} from "../Storage/index.head";
import {ITextCacheManager} from "../TextCache/TextCache.head";

export module FB3MediaCache {
	type BlobExtended = Blob | ArrayBuffer | string;
	/**
	 * This class is responsible for manipulation media (mainly images as blobs) via querying to IndexedDB
	 */
	export class MediaCache implements IFB3StorageCacheProvider {
		private readonly ArtKey: string;
		private QueryCreator: IQueryable<BlobExtended>;

		/**
		 * @param QueryCreator
		 * @param {string} ArtKey - key of required art's cache
		 * @constructor
		 */
		constructor(QueryCreator: IQueryable<BlobExtended>, ArtKey: string) {
			this.QueryCreator = QueryCreator;
			this.ArtKey = ArtKey;
		}

		private newQuery() {
			return this.QueryCreator.query(FB_MEDIA_CACHE_STORE_IDB_OBJECT_NAME);
		}

		/**
		 * Saves media as blob (or as string if Blob Storage is not supported in IndexedDB) to IndexedDB
		 * @param {string} MediaItemAlias
		 * @param {Blob} MediaItemBlob
		 * @param {Function} Callback - function called after successful saving
		 * @param {Function} FailureCallback - function called when failed to save data
		 */
		public SaveMediaItem(MediaItemAlias: string, MediaItemBlob: Blob, Callback = () => {}, FailureCallback = () => {}) {
			this.newQuery().put(MediaItemBlob, [this.ArtKey, MediaItemAlias]).then(() => Callback()).catch((e) => {
				const reader = new FileReader();
				reader.onload = (event) => {
					const StringDataToSave = event.target.result;

					this.newQuery().put(StringDataToSave, [this.ArtKey, MediaItemAlias]).then(() => Callback()).catch((e) => {
						console.warn('[FB3MediaCache] Unable to save image', e);
						FailureCallback();
					});
				};
				reader.readAsDataURL(MediaItemBlob);
			});
		}

		/**
		 * Retrieves media as blob from IndexedDB
		 * @param {string} MediaItemAlias
		 * @param {Function} Callback - function called after data retrieved successfully
		 * @param {Function} FailureCallback - function called when some problem occurred while trying to retrieve data
		 */
		public GetMediaItem(MediaItemAlias: string, Callback = (data: BlobExtended) => {}, FailureCallback: Function = () => {}) {
			this.newQuery().get([this.ArtKey, MediaItemAlias])
				.then(res => Callback(res))
				.catch(() => FailureCallback());
		}

		/**
		 * Deletes all records of chunks from IndexedDB with current ArtKey
		 * @param Callback
		 */
		public Clear(Callback: Function = () => {}) {
			this.newQuery().getAllKeys().then(allKeys => {
				const keysToDelete = allKeys.filter(key => key[0] === this.ArtKey);
				const deletePromises = keysToDelete.map(keyToDelete => this.newQuery().delete(keyToDelete));
				// @ts-ignore
				Promise.all(deletePromises).then(() => Callback());
			});
		}
	}

	export class MediaCacheLoader {
		private TextCacheManager: ITextCacheManager;
		private ArtKey: string;
		private ActiveRequests: {[MediaSource: string]: {SuccessCallback: (MediaData: Blob, StoreFileName: string) => void, FailureCallback: () => void}[]};

		constructor(TextCacheManager: ITextCacheManager, BaseURL: string) {
			this.TextCacheManager = TextCacheManager;
			this.ArtKey = this.TextCacheManager.GetStorageKey(BaseURL);
			this.ActiveRequests = {};
		}

		/**
		 * Loads media given in MediaSource, and then insert it in element with id=ElementID according to InsertionRules
		 * Media will be loaded asynchronously and then inserted
		 * @param MediaSource - url to media
		 * @param SuccessCallback
		 * @param FailureCallback
		 */
		public LoadImageAsync(MediaSource: string, SuccessCallback: (MediaData: Blob, StoreFileName: string) => void, FailureCallback: () => void) {
			// if have multiple requests for one media source - we won't process all of them through IndexedDB
			// we will remember all these requests and then call ProcessBlobData on each (performing only one XHR/IndexedDB request instead of multiple)
			if (this.ActiveRequests[MediaSource]) {
				this.ActiveRequests[MediaSource].push({SuccessCallback, FailureCallback});
				return;
			}
			this.ActiveRequests[MediaSource] = [];
			this.ActiveRequests[MediaSource].push({SuccessCallback, FailureCallback});
			// if we can use text/media caching - just using it, otherwise normal xhr request
			this.TextCacheManager.Use(() => {
				this.TextCacheManager.LoadMediaData(this.ArtKey, MediaSource, (BlobData, StoreFileName) => {
					if (BlobData) {
						this.OnMediaLoaded(MediaSource, BlobData, StoreFileName);
					} else {
						this.LoadMediaSource(MediaSource, (BlobData) => {
							this.TextCacheManager.SaveMediaData(this.ArtKey, MediaSource, BlobData, (StoreFileName) => {
								this.OnMediaLoaded(MediaSource, BlobData, StoreFileName);
							}, () => {
								this.OnMediaLoaded(MediaSource, BlobData, undefined);
							});
						});
					}
				});
			}, () => {
				this.LoadMediaSource(MediaSource, (BlobData) => {
					this.OnMediaLoaded(MediaSource, BlobData, null);
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

		private OnMediaLoaded(MediaSource, BlobData, StoreFileName: string) {
			this.ActiveRequests[MediaSource].forEach(({SuccessCallback}) => {
				SuccessCallback(BlobData, StoreFileName);
			});
			delete this.ActiveRequests[MediaSource];
		}

		public static ProcessBlobData(ElementID: string, MediaData: Blob, InsertionRules: string) {
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