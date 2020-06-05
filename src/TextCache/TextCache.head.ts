import {FB3IndexedDBDriver} from "../Storage/Storage";
import {FB3MediaCache} from "../MediaCache/MediaCache";

export interface IArtCacheItem {
	Key: string;
	Cached: boolean;
}

export interface IArtTextCacheData {
	Key: string;
	ObjectStoreName: string;
	FullCached: boolean;
	Chunks: {[ChunkAlias: string]: IArtCacheItem};
	Media: {[MediaAlias: string]: IArtCacheItem};
	LastUsedTimestamp?: number;
	ArtId: number;
	IsFullVersion: boolean;
	CacheReason: string;
	MediaStorageMarkers: {[StorageMarker: string]: string}
	ReaderVersion: string;
}

export interface IArtCacheDataSchema {
	ArtKey: string;
	ChunkAlias: string;
	Data: any;
	CustomData: any;
}

export interface ICachedArtSummary {
	id: number;
	isFullCached: boolean;
	isFullVersion: boolean;
	cacheReason: string;
	meta?: {
		title?: string;
		author?: any;
	},
	media?: {
		coverImage?: Blob
	}
}

export interface ITextCacheManager {
	Use(SuccessCallback: () => void, FailureCallback: () => void): void;
	SaveChunkData(ArtKey: string, ChunkURL: string, ChunkData: any, ChunkCustomData: any, Callback: () => void): void;
	LoadChunkData(ArtKey: string, ChunkURL: string, Callback: (data, customData) => void): void;
	SaveMediaData(ArtKey: string, MediaURL: string, MediaData: Blob, Callback: (MediaFileName: string) => void, FailureCallback: () => void): void;
	LoadMediaData(ArtKey: string, MediaURL: string, Callback: (data, storeFileName) => void): void;
	GetStorageKey(BaseUrl: string): string;
	InitializeTextCacheData(ArtKey: string, ArtId: number, IsFullVersion: boolean, CacheReason: string);
	AddMediaStorageMarker(ArtKey: string, MediaFileName: string, Marker: string): void;
}