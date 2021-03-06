import {IXPath} from "../DOM/FB3DOM.head";
import {IPageRenderInstruction} from "../Reader/FB3Reader.head";

export interface IStorageDriver {
	IsLocal: boolean;
	LoadData(StoreName: string, Callback: Function): string;
	SaveData(StoreName: string, Key: string, CacheMarkupList: IPageRenderInstructionsCacheEntry, Data?: IPageRenderInstructionsCacheEntry[], Callback?: Function): void;
	Find(StoreName: string, Key, Callback?: (CacheMarkupList) => {});
}

export interface IPageRenderInstructionsCacheEntry {
	Time: Date;
	Key: string;
	LastPage: number;
	Cache: IPageRenderInstruction[];
	MarginsCache: any; // we are going to store a plain hash here for all "margined" elements
}

export interface IFB3PPCache {
	Encrypt: boolean;
	IsReady: boolean;
	Set(I: number, Instr: IPageRenderInstruction): void;
	Get(I: number): IPageRenderInstruction;
	Save(Key: string): void;
	Load(Key: string): void;
	SetMargin(XP: string, Margin: number): void;
	GetMargin(XP: string): number;
	Reset(): void;
	Length(): number;
	LastPage(LastPageN?: number): number;
	CheckIfKnown(From: IXPath): number;
	LoadData(Callback?: Function): void;
	LoadDataAsync(ArtID: string);
	SaveData(Key: String, Data: IPageRenderInstructionsCacheEntry[], Callback?: Function): void;
}

export interface IFB3StorageCacheProvider {
	Clear(Callback: Function);
}

/**
 * Fix for TypeScript bug with FileReader event property
 * https://github.com/Microsoft/TypeScript/issues/299#issuecomment-168538829
 */
export interface FileReaderEventTarget extends EventTarget {
	result: string;
}

export interface FileReaderEvent extends Event {
	target: FileReaderEventTarget;
	getMessage(): string;
}
