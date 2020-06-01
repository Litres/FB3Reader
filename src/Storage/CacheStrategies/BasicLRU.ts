import {ICacheStrategy} from "../index.head";

/**
 * Generic realization of LRU
 * Have a constant number of maximum records and a special Key which we will use to detect the oldest item
 */
export class BasicLRUCacheStrategy<TCollectionSchema> implements ICacheStrategy<TCollectionSchema> {
	private readonly maxNumberOfRecords: number;
	private recentKey: number | string;
	private cacheUniqueKeyPath: string[];

	constructor(maxNumberOfRecords: number, recentKey: number | string) {
		this.maxNumberOfRecords = maxNumberOfRecords;
		this.recentKey = recentKey;
	}

	public setUniqueKeyPath(keyPath: string[]) {
		this.cacheUniqueKeyPath = keyPath;
	}

	public prepare(newRecord: TCollectionSchema, existingRecords: TCollectionSchema[]): string[][] {
		// simple case: we have space for new records
		if (existingRecords.length < this.maxNumberOfRecords) {
			return [];
		}

		/**
		 * We are out of records, so:
		 * 1) Sort all existing records in ascending order
		 * 2) Pick N first records in a sorted array (where N is the number of records we need to delete to be able to fit one more record)
		 * 3) From each record in resulted array pick only keys that belong to cacheUniqueKeyPath
		 * 4) We are ready with keyPaths which need to be deleted before inserting new values - Basic LRU done
		 */
		const primaryKeysToDelete: string[][] = [];
		const recordsToDelete = existingRecords.sort((a, b) => a[this.recentKey] - b[this.recentKey]).slice(0, existingRecords.length - this.maxNumberOfRecords + 1);

		for (let record of recordsToDelete) {
			primaryKeysToDelete.push(this.cacheUniqueKeyPath.map(key => record[key]));
		}

		return primaryKeysToDelete;
	}
}