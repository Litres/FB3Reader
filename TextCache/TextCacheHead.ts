module FB3TextCache {
	export interface IArtCacheItem {
		Key: string;
		Cached: boolean;
	}

	export interface IArtTextCacheData {
		Key: number;
		ObjectStoreName: string;
		FullCached: boolean;
		Chunks: {[ChunkAlias: string]: IArtCacheItem};
		Media: {[MediaAlias: string]: IArtCacheItem};
		LastUsedTimestamp: number;
	}
}