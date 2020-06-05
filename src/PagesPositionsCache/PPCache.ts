import {FB3Reader} from "../Reader/FB3Reader";
import {IFB3PPCache, IPageRenderInstructionsCacheEntry} from "../Storage/Storage.head";
import {IPageRenderInstruction} from "../Reader/FB3Reader.head";
import {IXPath} from "../DOM/FB3DOM.head";

import {ICollectionQuery, IQueryable} from "../Storage/index.head";
import {FB3LocalStorageDriver, FB3IndexedDBDriver, PP_CACHE_LOCAL_STORAGE_KEY, PP_CACHE_IDB_OBJECT_NAME} from '../Storage/Storage';
import {StorageType} from "../Storage/Tools";

export module FB3PPCache {
	export var MaxCacheRecords: number = 15;

	var SkipCache: boolean = false; // For debug purposes

	export class PPCache implements IFB3PPCache {
		private PagesPositionsCache: IPageRenderInstruction[];
		private CacheMarkupsList: IPageRenderInstructionsCacheEntry[];
		private LastPageN: number;
		private MarginsCache: any; // we are going to store a plain hash here for all "margined" elements
		public Encrypt: boolean = true;
		public IsReady: boolean = false;
		private DriverStorageType: StorageType;
		private AppVersion: string;

		constructor(AppVersion: string, DriverType: StorageType = StorageType.NoStorage) {
			this.DriverStorageType = DriverType;
			this.AppVersion = AppVersion;

			this.Reset();
		}

		public NewPPCacheQuery(): ICollectionQuery<IPageRenderInstructionsCacheEntry> {
			// if we have LocalStorage OR failed IndexedDB - use LocalStorage
			if (this.DriverStorageType === StorageType.LocalStorage || FB3IndexedDBDriver.getDriver().hasFailedToOpen()) {
				const driver: IQueryable<IPageRenderInstructionsCacheEntry> = FB3LocalStorageDriver.getDriver(this.AppVersion);
				return driver.query(PP_CACHE_LOCAL_STORAGE_KEY);

			} else if (this.DriverStorageType === StorageType.IndexedDB) {
				const driver: IQueryable<IPageRenderInstructionsCacheEntry> = FB3IndexedDBDriver.getDriver();
				return driver.query(PP_CACHE_IDB_OBJECT_NAME);
			}
		}

		public Get(I: number): IPageRenderInstruction {
			return this.PagesPositionsCache[I];
		}
		public Set(I: number, Instr: IPageRenderInstruction): void {
			this.PagesPositionsCache[I] = Instr;
		}

		public Reset(): void {
			this.CacheMarkupsList = null;
			this.PagesPositionsCache = new Array();
			this.MarginsCache = {};
			//this.IsReady = this.Driver.IsLocal;
		}

		public Length(): number {
			return this.PagesPositionsCache.length;
		}

		public Save(Key: string): void {
			if (SkipCache) {
				return;
			}

			// We are going to save no more than 50 cache entries
			// We reuse slots on write request based on access time
			if (this.DriverStorageType !== StorageType.NoStorage) {
				if (!this.CacheMarkupsList) {
					this.LoadOrFillEmptyData(() => {
						this.SaveData(Key, this.CacheMarkupsList);
					});
				} else {
					this.SaveData(Key, this.CacheMarkupsList);
				}
			}
		}

		public Load(Key: string): void {
			if (SkipCache) {
				this.IsReady = true;
				return;
			}

			if (this.DriverStorageType !== StorageType.NoStorage) {
				if (!this.CacheMarkupsList) {
					this.LoadOrFillEmptyData((CacheMarkupsList) => {
						this.NewPPCacheQuery().get([Key]).then((CacheMarkupList) => {
							if (CacheMarkupList) {
								this.PagesPositionsCache = CacheMarkupList.Cache;
								this.MarginsCache = CacheMarkupList.MarginsCache;
								this.LastPageN = CacheMarkupList.LastPage;
							}

							this.IsReady = true;
						}).catch(() => {});
					});
				}
			}
		}

		public LoadDataAsync(ArtID: string) { }

		private LoadOrFillEmptyData(Callback = (CacheMarkupsList: IPageRenderInstructionsCacheEntry[]) => {}): void {
			this.LoadData((cacheData) => {
				var DataInitDone = false;
				if (cacheData) {
					try {
						this.CacheMarkupsList = cacheData;
						DataInitDone = true;
					} catch (e) { }
				}
				if (!DataInitDone) {
					this.CacheMarkupsList = [];
				}
				Callback(this.CacheMarkupsList);
			});
		}

		public LastPage(LastPageN?: number): number {
			if (LastPageN == undefined) {
				return this.LastPageN;
			} else {
				this.LastPageN = LastPageN;
			}
		}
		public SetMargin(XP: string, Margin: number): void {
			this.MarginsCache[XP] = Margin;
		}

		public GetMargin(XP: string): number {
			return this.MarginsCache[XP];
		}

		public CheckIfKnown(From: IXPath): number {
			for (var I = 1; I < this.PagesPositionsCache.length; I++) {
				if (FB3Reader.PosCompare(this.PagesPositionsCache[I].Range.From, From) === 0) {
					return I;
				}
			}
			return undefined;
		}

		public LoadData(Callback = (compressedCacheData) => {}): void {
			this.NewPPCacheQuery().getAll().then(result => Callback(result));
		}

		public SaveData(Key: String, Data: IPageRenderInstructionsCacheEntry[], Callback = () => {}): void {
			this.NewPPCacheQuery().put(<IPageRenderInstructionsCacheEntry> {
				Time: new Date,
				Key: Key,
				Cache: this.PagesPositionsCache,
				LastPage: this.LastPageN,
				MarginsCache: this.MarginsCache
			}).then(() => Callback());
		}
	}

}