/// <reference path="PPCacheHead.ts" />
/// <reference path="../Storage/StorageHead.ts" />
/// <reference path="../plugins/lz-string.d.ts" />

module FB3PPCache {
	export var MaxCacheRecords: number = 15;

	var SkipCache: boolean = false; // For debug purposes

	const LocalStorageName: string = 'FB3Reader1.0';
	const IndexedDBStoreName: string = "FBReaderStore";

	export class PPCache implements FB3Storage.IFB3PPCache {
		private PagesPositionsCache: FB3Reader.IPageRenderInstruction[];
		private CacheMarkupsList: FB3Storage.IPageRenderInstructionsCacheEntry[];
		private LastPageN: number;
		private MarginsCache: any; // we are going to store a plain hash here for all "margined" elements
		public Encrypt: boolean = true;
		public IsReady: boolean = false;
		private StorageName: string;

		private Driver;

		constructor(Driver: string = FB3Storage.LOCAL_STORAGE) {
			if (Driver === FB3Storage.LOCAL_STORAGE) {
				this.Driver = new FB3Storage.LocalStorageDriver(this, MaxCacheRecords);
				this.StorageName = LocalStorageName;
			} else if (Driver === FB3Storage.INDEXED_DB) {
				this.Driver = new FB3Storage.IndexedDBDriver(this);
				this.StorageName = IndexedDBStoreName;
			}

			this.Reset();
		}

		public Get(I: number): FB3Reader.IPageRenderInstruction {
			return this.PagesPositionsCache[I];
		}
		public Set(I: number, Instr: FB3Reader.IPageRenderInstruction): void {
			this.PagesPositionsCache[I] = Instr;
		}

		public Reset(): void {
			this.CacheMarkupsList = null;
			this.PagesPositionsCache = new Array();
			this.MarginsCache = {};
			this.IsReady = this.Driver.IsLocal;
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

			if (FB3Storage.CheckStorageAvail() !== FB3Storage.NO_STORAGE) {
				if (!this.CacheMarkupsList) {
					this.LoadOrFillEmptyData(() => {
						this.SaveData(Key, this.CacheMarkupsList);
					});
				} else {
					this.SaveData(Key, this.CacheMarkupsList);
				}

			}//  else { no luck, no store - recreate from scratch } 
		}

		public Load(Key: string): void {
			if (SkipCache) {
				this.IsReady = true;
				return;
			}
			if (FB3Storage.CheckStorageAvail() !== FB3Storage.NO_STORAGE) {
				if (!this.CacheMarkupsList) {
					this.LoadOrFillEmptyData((CacheMarkupsList) => {
						this.Driver.Find(this.StorageName, Key, (CacheMarkupList) => {
							if (CacheMarkupList) {
								this.PagesPositionsCache = CacheMarkupList.Cache;
								this.MarginsCache = CacheMarkupList.MarginsCache;
								this.LastPageN = CacheMarkupList.LastPage;
							}

							this.IsReady = true;
						});
					});
				}
			}
		}

		public LoadDataAsync(ArtID: string) { }

		private LoadOrFillEmptyData(Callback = (CacheMarkupsList: FB3Storage.IPageRenderInstructionsCacheEntry[]) => {}): void {
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

		public CheckIfKnown(From: FB3DOM.IXPath): number {
			for (var I = 1; I < this.PagesPositionsCache.length; I++) {
				if (FB3Reader.PosCompare(this.PagesPositionsCache[I].Range.From, From) === 0) {
					return I;
				}
			}
			return undefined;
		}

		public LoadData(Callback = (compressedCacheData) => {}): string {
			return this.Driver.LoadData(this.StorageName, Callback);
		}

		public SaveData(Key: String, Data: FB3Storage.IPageRenderInstructionsCacheEntry[], Callback = () => {}): void {
			this.Driver.SaveData(this.StorageName, Key, <FB3Storage.IPageRenderInstructionsCacheEntry> {
				Time: new Date,
				Key: Key,
				Cache: this.PagesPositionsCache,
				LastPage: this.LastPageN,
				MarginsCache: this.MarginsCache
			}, Data, Callback);
		}
	}

}