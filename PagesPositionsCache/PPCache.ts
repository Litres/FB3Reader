/// <reference path="PPCacheHead.ts" />

module FB3PPCache {
	var SkipCache = false; // For debug purposes
	interface IPageRenderInstructionsCacheEntry {
		Time: Date;
		Key: string;
		LastPage: number;
		Cache: FB3Reader.IPageRenderInstruction[];
	}

	export class PPCache implements IFB3PPCache {
		private PagesPositionsCache: FB3Reader.IPageRenderInstruction[];
		private CacheMarkupsList: IPageRenderInstructionsCacheEntry[];
		private LastPageN: number;

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

			if (typeof (Storage) !== "undefined" && localStorage && JSON) {
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
				if (this.CacheMarkupsList.length >= 15) {
					this.CacheMarkupsList.shift();
				}
				this.CacheMarkupsList.push(
						{
							Time: new Date,
							Key: Key,
							Cache: this.PagesPositionsCache,
							LastPage: this.LastPageN
						}
					);
				// Keep in mind - next line is really, really slow
				localStorage['FB3Reader1.0'] = JSON.stringify(this.CacheMarkupsList);
			}//  else { no luck, no store - recreate from scratch } 
		}

		public Load(Key: string): void {
			if (SkipCache) {
				return;
			}
			if (typeof (Storage) !== "undefined" && localStorage && JSON) {
				if (!this.CacheMarkupsList) {
					this.LoadOrFillEmptyData();
				}
				for (var I = 0; I < this.CacheMarkupsList.length; I++) {
					if (this.CacheMarkupsList[I].Key == Key) {
						this.PagesPositionsCache = this.CacheMarkupsList[I].Cache;
						this.LastPageN = this.CacheMarkupsList[I].LastPage;
						break;
					}
				}
			}
		}

		private LoadOrFillEmptyData(): void {
			var CacheData = localStorage['FB3Reader1.0'];
			var DataInitDone = false;
			if (CacheData) {
				try {
					this.CacheMarkupsList = JSON.parse(CacheData);
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

	}

}