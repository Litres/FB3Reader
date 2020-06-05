import {ICacheStrategy} from "../index.head";
import {IArtTextCacheData} from "../../TextCache/TextCache.head";

/**
 * Specific LRU logic for caching arts (text and media)
 * Notice there can be Full and Trial version of arts (defined by property IArtTextCacheData.IsFullVersion)
 * There is also can be different reason to cache arts (this is defined by property IArtTextCacheData.CacheReason):
 * 		> "auto" - means that art was cached automatically
 * 		> "manual" - e.g. cached by user with help of some GUI
 *
 * The logic of this strategy is based on the following ideas:
 * 		> there is some initial number of maximum possible records (defined by initialNumberOfMaxRecords)
 * 		> initial number of maximum records can be extended up to extendedNumberOfMaxRecords by adding records with CacheReason="manual"
 * 		> there is some minimum amount of automatically cached records that are stored (defined by minimumNumberOfAutoRecords)
 * 		> if extendedNumberOfMaxRecords is reached we first try to delete "auto" record, if fails we delete "manual" one
 */
export class ArtDataLRU implements ICacheStrategy<IArtTextCacheData> {
	private readonly initialNumberOfMaxRecords: number;
	private readonly extendedNumberOfMaxRecords: number;
	private readonly minimumNumberOfAutoRecords: number;

	private readonly AppVersion: string;

	private cacheUniqueKeyPath: string[];

	constructor(initialNumberOfMaxRecords: number, extendedNumberOfMaxRecords: number, minimumNumberOfAutoRecords: number, AppVersion: string) {
		this.initialNumberOfMaxRecords = initialNumberOfMaxRecords;
		this.extendedNumberOfMaxRecords = extendedNumberOfMaxRecords;
		this.minimumNumberOfAutoRecords = minimumNumberOfAutoRecords;

		this.AppVersion = AppVersion;
	}

	public setUniqueKeyPath(keyPath: string[]) {
		this.cacheUniqueKeyPath = keyPath;
	}

	public prepare(newRecord: IArtTextCacheData, existingRecords: IArtTextCacheData[]): string[][] {
		// records with incorrect App Version should be deleted anyway
		const deprecatedRecordsKeys = existingRecords.filter(record => record.ReaderVersion !== this.AppVersion).map(record => this.getPrimaryKeyFromRecord(record));

		return [...this.processLRU(newRecord, existingRecords), ...deprecatedRecordsKeys];
	}

	private processLRU(newRecord: IArtTextCacheData, existingRecords: IArtTextCacheData[]): string[][] {
		// if we have enough storage - don't remove anything from currect version (but still remove old items)
		if (existingRecords.length < this.initialNumberOfMaxRecords) {
			return [];
		}

		// if storage is full - try to find oldest trial art and remove it
		const oldestNotFullArtItem = ArtDataLRU.findOldestArtItem(existingRecords, record => record.IsFullVersion === false);
		if (oldestNotFullArtItem) {
			return [this.getPrimaryKeyFromRecord(oldestNotFullArtItem)];
		}

		// if we want to insert new record which is auto or trial - removes the oldest auto cached item (we will always have at least 2 of this type)
		if ((newRecord.CacheReason === "auto") || (newRecord.IsFullVersion === false)) {
			const oldestAutoSavedArtItem = ArtDataLRU.findOldestArtItem(existingRecords, record => record.CacheReason === "auto");
			if (oldestAutoSavedArtItem) {
				return [this.getPrimaryKeyFromRecord(oldestAutoSavedArtItem)];
			}
		}

		// special logic for manual arts adding
		if (newRecord.CacheReason === "manual") {
			// we have special extended number of possible records (for "manual" caches), so we don't clean anything if we are not out of extended number of records
			if (existingRecords.length < this.extendedNumberOfMaxRecords) {
				return [];
			}

			// Here we ran out of extended number of records, trying to remove some record which was cached automatically
			if (existingRecords.filter(record => record.CacheReason === "auto").length > this.minimumNumberOfAutoRecords) {
				const oldestAutoSavedArtItem = ArtDataLRU.findOldestArtItem(existingRecords, record => record.CacheReason === "auto");
				if (oldestAutoSavedArtItem) {
					return [this.getPrimaryKeyFromRecord(oldestAutoSavedArtItem)];
				}
			}

			// Last case - just replace the oldest manual record
			const oldestManuallySavedArtItem = ArtDataLRU.findOldestArtItem(existingRecords, record => record.CacheReason === "manual");
			if (oldestManuallySavedArtItem) {
				return [this.getPrimaryKeyFromRecord(oldestManuallySavedArtItem)];
			}
		}

		// Actually it's not the case: upper logic should work ok for all cases
		// But to be sure that everything is ok we will remove just the oldest record
		const oldestArtItem = ArtDataLRU.findOldestArtItem(existingRecords, record => record.CacheReason === "manual");
		if (oldestArtItem) {
			return [this.getPrimaryKeyFromRecord(oldestArtItem)];
		} else {
			return [];
		}
	}

	private static findOldestArtItem(records: IArtTextCacheData[], attributeFunction: (record: IArtTextCacheData) => boolean): IArtTextCacheData {
		let result = undefined;
		for (let record of records) {
			if (attributeFunction(record) === true && (!result || (result.LastUsedTimestamp > record.LastUsedTimestamp))) {
				result = record;
			}
		}

		return result;
	}

	private getPrimaryKeyFromRecord(record: IArtTextCacheData) {
		return this.cacheUniqueKeyPath.map(key => record[key]);
	}
}