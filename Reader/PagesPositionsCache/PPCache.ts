/// <reference path="PPCacheHead.ts" />

module FB3PPCache {

	interface IPageRenderInstructionsCacheEntry {
		Time: Date;
		Key: string;
		Cache: FB3Reader.IPageRenderInstruction[];
	}

	class PPCache implements IFB3PPCache {
		private PagesPositionsCache: FB3Reader.IPageRenderInstruction[];
		private CacheMarkupsList: IPageRenderInstructionsCacheEntry[];

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
			// We are going to save no more than 50 cache entries
			// We reuse slots on fill based on access time

			if (typeof (Storage) !== "undefined" && localStorage && JSON) {
				// localStorage support required
				if (!this.CacheMarkupsList) {
					this.CacheMarkupsList = JSON.parse(localStorage['FB3Reader1.0']);
				}
				var RowToFillID: string;
				var OldestIDTime: number;
				for (var I = 0; I < this.CacheMarkupsList.length; I++) {
					if (this.CacheMarkupsList[I].Key == Key) {
						this.CacheMarkupsList.splice(I, 1);
					}
				}
				if (this.CacheMarkupsList.length >= 50) {
					this.CacheMarkupsList.shift();
				}
				this.CacheMarkupsList.push(
						{
							Time: new Date,
							Key: Key,
							Cache: this.PagesPositionsCache
						}
					);
				localStorage['FB3Reader1.0'] = JSON.stringify(this.CacheMarkupsList);
			}//  else { no luck, no store - recreate from scratch } 
		}

		public Load(Key: string): void {
			if (typeof (Storage) !== "undefined" && localStorage && JSON) {
				if (!this.CacheMarkupsList) {
					this.CacheMarkupsList = JSON.parse(localStorage['FB3Reader1.0']);
				}
				for (var I = 0; I < this.CacheMarkupsList.length; I++) {
					if (this.CacheMarkupsList[I].Key == Key) {
						this.PagesPositionsCache = this.CacheMarkupsList[I].Cache;
					}
				}
			}
		}

	}

}