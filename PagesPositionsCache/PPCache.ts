/// <reference path="PPCacheHead.ts" />
/// <reference path="../plugins/lz-string.d.ts" />

module FB3PPCache {
	export function CheckStorageAvail(): boolean {
		if (FB3PPCache.LocalStorage !== undefined) {
			return FB3PPCache.LocalStorage;
		}
		try {
			window.localStorage['working'] = 'true';
			FB3PPCache.LocalStorage = true;
			window.localStorage.removeItem('working');
		} catch (e) {
			FB3PPCache.LocalStorage = false;
		}
		return FB3PPCache.LocalStorage;
	}

	export var MaxCacheRecords: number = 15;
	export var LocalStorage: boolean; // global for window.localStorage check

	var SkipCache: boolean = false; // For debug purposes

	interface IPageRenderInstructionsCacheEntry {
		Time: Date;
		Key: string;
		LastPage: number;
		Cache: FB3Reader.IPageRenderInstruction[];
		MarginsCache: any; // we are going to store a plain hash here for all "margined" elements
	}

	export class PPCache implements IFB3PPCache {
		private PagesPositionsCache: FB3Reader.IPageRenderInstruction[];
		private CacheMarkupsList: IPageRenderInstructionsCacheEntry[];
		private LastPageN: number;
		private MarginsCache: any; // we are going to store a plain hash here for all "margined" elements
		public Encrypt: boolean = true;

		constructor() {
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

			if (FB3PPCache.CheckStorageAvail()) {
				// localStorage support required
				if (!this.CacheMarkupsList) {
					this.LoadOrFillEmptyData();
				}
				var RowToFillID: string;
				var OldestIDTime: number;
				for (var I = 0; I < this.CacheMarkupsList.length; I++) {
					if (this.CacheMarkupsList[I].Key == Key) {
						this.CacheMarkupsList.splice(I, 1);
					}
				}
				if (this.CacheMarkupsList.length >= MaxCacheRecords) {
					this.CacheMarkupsList.shift();
				}
				this.CacheMarkupsList.push(
						{
							Time: new Date,
							Key: Key,
							Cache: this.PagesPositionsCache,
							LastPage: this.LastPageN,
							MarginsCache: this.MarginsCache
						}
					);
				// Keep in mind - next line is really, really slow
				var uncompressdCacheData = JSON.stringify(this.CacheMarkupsList);
				this.SaveData(this.EncodeData(uncompressdCacheData));

			}//  else { no luck, no store - recreate from scratch } 
		}

		public Load(Key: string): void {
			if (SkipCache) {
				return;
			}
			if (FB3PPCache.CheckStorageAvail()) {
				if (!this.CacheMarkupsList) {
					this.LoadOrFillEmptyData();
				}
				for (var I = 0; I < this.CacheMarkupsList.length; I++) {
					if (this.CacheMarkupsList[I].Key == Key) {
						this.PagesPositionsCache = this.CacheMarkupsList[I].Cache;
						this.MarginsCache = this.CacheMarkupsList[I].MarginsCache;
						this.LastPageN = this.CacheMarkupsList[I].LastPage;
						break;
					}
				}
			}
		}

		public LoadDataAsync(ArtID: string) { }

		private LoadOrFillEmptyData(): void {
			var compressedCacheData = this.LoadData();
			var DataInitDone = false;
			if (compressedCacheData) {
				try {
					var cacheData = this.DecodeData(compressedCacheData);
					this.CacheMarkupsList = JSON.parse(cacheData);
					DataInitDone = true;
				} catch (e) { }
			}
			if (!DataInitDone) {
				this.CacheMarkupsList = new Array();
			}
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

		private DecodeData(Data) {
			if (this.Encrypt) {
				return LZString.decompressFromUTF16(Data);
			} else {
				return Data;
			}
		}

		private EncodeData(Data) {
			if (this.Encrypt) {
				return LZString.compressToUTF16(Data);
			} else {
				return Data;
			}
		}

		public LoadData(): string {
			return localStorage['FB3Reader1.0'];
		}

		public SaveData(Data: string): void {
			localStorage['FB3Reader1.0'] = Data;
		}

	}

}